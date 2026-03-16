import { vi } from "vitest";

export const createSalesTxMock = () => ({
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
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
});

export type SalesTxMock = ReturnType<typeof createSalesTxMock>;
