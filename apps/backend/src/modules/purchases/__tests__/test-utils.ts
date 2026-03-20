import { vi } from "vitest";

export const createPurchaseTxMock = () => ({
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
  documentHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  itemVariant: {
    findMany: vi.fn(),
  },
  party: {
    findFirst: vi.fn(),
  },
});

export type PurchaseTxMock = ReturnType<typeof createPurchaseTxMock>;
