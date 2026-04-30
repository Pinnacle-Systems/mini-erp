import { vi } from "vitest";

export const createSalesTxMock = () => {
  const stockLedgerCreateMany = vi.fn();

  return ({
  document: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  documentHistory: {
    create: vi.fn(),
  },
  itemVariant: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  party: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  financialAccount: {
    findFirst: vi.fn(),
  },
  businessLocation: {
    findFirst: vi.fn(),
  },
  documentLineLink: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
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
  });
};

export type SalesTxMock = ReturnType<typeof createSalesTxMock>;
