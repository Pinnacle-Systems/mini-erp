import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock: any = {
    $transaction: vi.fn(),
    financialAccount: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    expenseCategory: {
      count: vi.fn(),
    },
    party: {
      findFirst: vi.fn(),
    },
    moneyMovement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    moneyMovementAllocation: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };

  mock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(mock));
  return mock;
});

vi.mock("../../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

import accountsService from "./accounts.service.js";

const resetPrismaMock = () => {
  vi.resetAllMocks();
  prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(prismaMock));
  prismaMock.financialAccount.count.mockResolvedValue(1);
  prismaMock.expenseCategory.count.mockResolvedValue(1);
};

describe("accounts.service", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("creates an unallocated received payment with a required party", async () => {
    prismaMock.financialAccount.findFirst.mockResolvedValue({
      id: "account-1",
      name: "Cash on Hand",
      location_id: null,
    });
    prismaMock.party.findFirst.mockResolvedValue({
      id: "party-1",
      name: "Acme Retail",
    });
    prismaMock.moneyMovement.create.mockResolvedValue({
      id: "movement-1",
      business_id: "tenant-1",
      direction: "INFLOW",
      status: "POSTED",
      source_kind: "PAYMENT_RECEIVED",
      source_document_type: null,
      source_document_id: null,
      occurred_at: new Date("2026-04-20T00:00:00.000Z"),
      amount: 100,
      currency: "INR",
      financial_account_id: "account-1",
      party_id: "party-1",
      party_name_snapshot: "Acme Retail",
      location_id: null,
      reference_no: null,
      notes: null,
    });

    const movement = await accountsService.createReceivedPayment(
      "tenant-1",
      {
        occurredAt: "2026-04-20T00:00:00.000Z",
        amount: 100,
        financialAccountId: "account-1",
        partyId: "party-1",
        allocations: [],
      },
      prismaMock as never,
    );

    expect(prismaMock.moneyMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          party_id: "party-1",
          party_name_snapshot: "Acme Retail",
        }),
      }),
    );
    expect(movement.allocated_amount).toBe(0);
    expect(movement.unallocated_amount).toBe(100);
  });

  it("rejects allocatable payments without a party", async () => {
    prismaMock.financialAccount.findFirst.mockResolvedValue({
      id: "account-1",
      name: "Cash on Hand",
      location_id: null,
    });

    await expect(
      accountsService.createReceivedPayment(
        "tenant-1",
        {
          occurredAt: "2026-04-20T00:00:00.000Z",
          amount: 100,
          financialAccountId: "account-1",
          allocations: [],
        },
        prismaMock as never,
      ),
    ).rejects.toThrow("Payment party is required for allocatable payments");
  });

  it("rejects duplicate allocation document rows during payment creation", async () => {
    prismaMock.financialAccount.findFirst.mockResolvedValue({
      id: "account-1",
      name: "Cash on Hand",
      location_id: null,
    });
    prismaMock.party.findFirst.mockResolvedValue({
      id: "party-1",
      name: "Acme Retail",
    });

    await expect(
      accountsService.createReceivedPayment(
        "tenant-1",
        {
          occurredAt: "2026-04-20T00:00:00.000Z",
          amount: 100,
          financialAccountId: "account-1",
          partyId: "party-1",
          allocations: [
            {
              documentType: "SALES_INVOICE",
              documentId: "invoice-1",
              allocatedAmount: 30,
            },
            {
              documentType: "SALES_INVOICE",
              documentId: "invoice-1",
              allocatedAmount: 20,
            },
          ],
        },
        prismaMock as never,
      ),
    ).rejects.toThrow("Duplicate allocation rows for the same document are not allowed");
  });

  it("allocates an existing payment to an invoice and returns updated totals", async () => {
    const createdAt = new Date("2026-04-21T10:00:00.000Z");

    prismaMock.moneyMovement.findFirst.mockResolvedValue({
      id: "movement-1",
      direction: "INFLOW",
      status: "POSTED",
      source_kind: "PAYMENT_RECEIVED",
      amount: 100,
      party_id: "party-1",
      party_name_snapshot: "Acme Retail",
    });
    prismaMock.moneyMovementAllocation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "allocation-1",
          money_movement_id: "movement-1",
          document_id: "invoice-1",
          document_type: "SALES_INVOICE",
          allocated_amount: 40,
          created_at: createdAt,
          money_movement: {
            status: "POSTED",
            source_kind: "PAYMENT_RECEIVED",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "allocation-1",
          money_movement_id: "movement-1",
          document_id: "invoice-1",
          document_type: "SALES_INVOICE",
          allocated_amount: 40,
          created_at: createdAt,
          money_movement: {
            status: "POSTED",
            source_kind: "PAYMENT_RECEIVED",
          },
        },
      ]);
    prismaMock.document.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "invoice-1",
          type: "SALES_INVOICE",
          party_id: "party-1",
          party_snapshot: { name: "Acme Retail" },
          location_id: null,
          grand_total: 40,
          doc_number: "SI-0001",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "invoice-1",
          type: "SALES_INVOICE",
          doc_number: "SI-0001",
          grand_total: 40,
          posted_at: new Date("2026-04-01T00:00:00.000Z"),
          location_id: null,
          party_id: "party-1",
          party_snapshot: { name: "Acme Retail" },
          status: "OPEN",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "invoice-1" }])
      .mockResolvedValueOnce([{ id: "invoice-1" }]);
    prismaMock.moneyMovementAllocation.create.mockResolvedValue({
      id: "allocation-1",
      document_type: "SALES_INVOICE",
      document_id: "invoice-1",
      allocated_amount: 40,
      created_at: createdAt,
    });

    const result = await accountsService.allocatePayment("tenant-1", "movement-1", [
      {
        documentType: "SALES_INVOICE",
        documentId: "invoice-1",
        allocatedAmount: 40,
      },
    ]);

    expect(result).toEqual({
      movement: {
        id: "movement-1",
        allocatedAmount: 40,
        unallocatedAmount: 60,
      },
      allocations: [
        {
          id: "allocation-1",
          documentType: "SALES_INVOICE",
          documentId: "invoice-1",
          allocatedAmount: 40,
          createdAt: createdAt.toISOString(),
        },
      ],
    });
  });

  it("rejects duplicate allocation document rows during later allocation", async () => {
    prismaMock.moneyMovement.findFirst.mockResolvedValue({
      id: "movement-1",
      direction: "INFLOW",
      status: "POSTED",
      source_kind: "PAYMENT_RECEIVED",
      amount: 100,
      party_id: "party-1",
      party_name_snapshot: "Acme Retail",
    });
    prismaMock.moneyMovementAllocation.findMany.mockResolvedValueOnce([]);
    prismaMock.document.findMany.mockResolvedValueOnce([]);

    await expect(
      accountsService.allocatePayment("tenant-1", "movement-1", [
        {
          documentType: "SALES_INVOICE",
          documentId: "invoice-1",
          allocatedAmount: 30,
        },
        {
          documentType: "SALES_INVOICE",
          documentId: "invoice-1",
          allocatedAmount: 20,
        },
      ]),
    ).rejects.toThrow("Duplicate allocation rows for the same document are not allowed");
  });

  it("includes allocated and unallocated totals in money movement rows using active allocations only", async () => {
    prismaMock.moneyMovement.findMany.mockResolvedValue([
      {
        id: "movement-1",
        direction: "INFLOW",
        status: "POSTED",
        source_kind: "PAYMENT_RECEIVED",
        source_document_type: null,
        source_document_id: null,
        occurred_at: new Date("2026-04-20T00:00:00.000Z"),
        amount: 100,
        currency: "INR",
        party_id: "party-1",
        party_name_snapshot: "Acme Retail",
        location_id: null,
        reference_no: null,
        notes: null,
        financial_account: {
          id: "account-1",
          name: "Cash on Hand",
        },
      },
    ]);
    prismaMock.moneyMovementAllocation.findMany.mockResolvedValue([
      {
        id: "allocation-1",
        money_movement_id: "movement-1",
        document_id: "invoice-1",
        document_type: "SALES_INVOICE",
        allocated_amount: 30,
        created_at: new Date("2026-04-20T00:00:00.000Z"),
        money_movement: {
          status: "POSTED",
          source_kind: "PAYMENT_RECEIVED",
        },
      },
      {
        id: "allocation-2",
        money_movement_id: "movement-1",
        document_id: "invoice-2",
        document_type: "SALES_INVOICE",
        allocated_amount: 20,
        created_at: new Date("2026-04-20T00:00:00.000Z"),
        money_movement: {
          status: "POSTED",
          source_kind: "PAYMENT_RECEIVED",
        },
      },
    ]);
    prismaMock.document.findMany.mockResolvedValue([{ id: "invoice-1" }]);

    const rows = await accountsService.listMoneyMovements("tenant-1", { limit: 10 });

    expect(rows).toEqual([
      expect.objectContaining({
        id: "movement-1",
        allocatedAmount: 30,
        unallocatedAmount: 70,
      }),
    ]);
  });

  it("filters open documents by party and uses ascending posted order", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);

    await accountsService.listOpenDocuments("tenant-1", "RECEIVABLE", 20, "party-1");

    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          business_id: "tenant-1",
          party_id: "party-1",
        }),
        orderBy: [{ posted_at: "asc" }, { doc_number: "asc" }, { id: "asc" }],
        take: 20,
      }),
    );
  });
});
