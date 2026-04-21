import { vi } from "vitest";

export const createPurchaseTxMock = () => {
  const stockLedgerCreateMany = vi.fn();

  return ({
  document: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  lineItem: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  documentLineLink: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  documentHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  itemVariant: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  businessLocation: {
    findFirst: vi.fn(),
  },
  syncChangeLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  stockLedger: {
    create: vi.fn(async ({ data }) => stockLedgerCreateMany({ data: [data] })),
    findMany: vi.fn(),
    createMany: stockLedgerCreateMany,
  },
  stockActivity: {
    create: vi.fn(),
  },
  party: {
    findFirst: vi.fn(),
  },
  });
};

export type PurchaseTxMock = ReturnType<typeof createPurchaseTxMock>;
