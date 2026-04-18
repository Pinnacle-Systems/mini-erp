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

const backfill = async () => {
  console.log("Starting backfill for sales_document_read_model...");
  
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
        const partySnapshot = parsePartySnapshot(document.party_snapshot);
        await appendSyncChange(
          tx,
          tenantId,
          "sales_document_read_model",
          document.id,
          "UPDATE",
          {
            id: document.id,
            documentType: document.type,
            documentNumber: document.doc_number,
            status: document.status,
            postedAt: document.posted_at ? new Date(document.posted_at).toISOString() : null,
            subTotal: Number(document.sub_total ?? 0),
            taxTotal: Number(document.tax_total ?? 0),
            grandTotal: Number(document.grand_total ?? 0),
            settlementSnapshot: null,
            customerId: document.party_id,
            customerName: partySnapshot?.name ?? "",
            isActive: true,
            updatedAt: new Date(document.updated_at).toISOString()
          }
        );
      }
    });

    console.log(`Backfilled ${eligibleDocuments.length} read models for business: ${tenantId}`);
  }
  console.log("Backfill complete.");
};

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
