import { vi } from "vitest";

export const createSalesTxMock = () => ({
  document: {
    findFirst: vi.fn(),
  },
  itemVariant: {
    findMany: vi.fn(),
  },
  documentLineLink: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  stockLedger: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
});

export type SalesTxMock = ReturnType<typeof createSalesTxMock>;
