import { prisma } from "../lib/prisma.js";
import { appendSyncChange } from "../modules/sync/sync.service.js";

const parsePartySnapshot = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const role = raw.role;
  const name = typeof raw.name === "string" ? raw.name : "";
  if ((role !== "customer" && role !== "supplier") || !name.trim()) {
    return null;
  }
  return { name: name.trim() };
};

const appendDocumentReadModel = async (
  tx: typeof prisma,
  tenantId: string,
  entity: "sales_document_read_model" | "purchase_document_read_model",
  document: {
    id: string;
    type: string;
    doc_number: string;
    status: string;
    posted_at: Date | null;
    sub_total?: unknown;
    tax_total?: unknown;
    grand_total?: unknown;
    party_id?: string | null;
    party_snapshot?: unknown;
    location_id?: string | null;
    location_name_snapshot?: string | null;
    updated_at: Date;
  },
) => {
  const partySnapshot = parsePartySnapshot(document.party_snapshot);
  await appendSyncChange(tx, tenantId, entity, document.id, "UPDATE", {
    id: document.id,
    documentType: document.type,
    documentNumber: document.doc_number,
    status: document.status,
    postedAt: document.posted_at ? new Date(document.posted_at).toISOString() : null,
    ...(entity === "sales_document_read_model"
      ? {
          subTotal: Number(document.sub_total ?? 0),
          taxTotal: Number(document.tax_total ?? 0),
          grandTotal: Number(document.grand_total ?? 0),
          settlementSnapshot: null,
          customerId: document.party_id ?? null,
          customerName: partySnapshot?.name ?? "",
        }
      : {
          grandTotal: Number(document.grand_total ?? 0),
          settlementSnapshot: null,
          supplierId: document.party_id ?? null,
          supplierName: partySnapshot?.name ?? "",
          locationId: document.location_id ?? null,
          locationName: document.location_name_snapshot ?? "",
        }),
    isActive: true,
    updatedAt: new Date(document.updated_at).toISOString(),
  });
};

const backfill = async () => {
  console.log("Starting backfill for sales and purchase document read models...");
  
  // Enforce retention boundary: get the last 100 eligible documents per business
  // We'll iterate over tenant IDs, or globally pull eligible and order by posted_at.
  // We get businesses first
  const businesses = await prisma.business.findMany({ select: { id: true } });
  
  for (const business of businesses) {
    const tenantId = business.id;
    const eligibleDocuments = await prisma.document.findMany({
      where: {
        business_id: tenantId,
        deleted_at: null,
        posted_at: { not: null },
        status: { in: ["OPEN", "PARTIAL", "COMPLETED", "CANCELLED"] },
      },
      orderBy: { posted_at: "desc" },
      take: 100, // Enforce projection retention boundary through backfill limit
    });
    
    if (eligibleDocuments.length === 0) continue;
    
    await prisma.$transaction(async (tx) => {
      // Because we want them to populate local sync engines, we append them chronologically ascending
      // so the freshest is inserted last and overrides locally exactly how it works natively.
      const docsToInsert = eligibleDocuments.reverse();
      for (const document of docsToInsert) {
        await appendDocumentReadModel(tx as typeof prisma, tenantId, "sales_document_read_model", document);
      }
    });

    const eligiblePurchaseDocuments = await prisma.document.findMany({
      where: {
        business_id: tenantId,
        deleted_at: null,
        posted_at: { not: null },
        type: { in: ["PURCHASE_ORDER", "GOODS_RECEIPT_NOTE", "PURCHASE_INVOICE", "PURCHASE_RETURN"] },
        status: { in: ["OPEN", "PARTIAL", "COMPLETED", "CANCELLED"] },
      },
      orderBy: { posted_at: "desc" },
      take: 100,
    });

    if (eligiblePurchaseDocuments.length > 0) {
      await prisma.$transaction(async (tx) => {
        const docsToInsert = eligiblePurchaseDocuments.reverse();
        for (const document of docsToInsert) {
          await appendDocumentReadModel(
            tx as typeof prisma,
            tenantId,
            "purchase_document_read_model",
            document,
          );
        }
      });
    }

    console.log(
      `Backfilled ${eligibleDocuments.length} sales and ${eligiblePurchaseDocuments.length} purchase read models for business: ${tenantId}`,
    );
  }
  console.log("Backfill complete.");
};

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
