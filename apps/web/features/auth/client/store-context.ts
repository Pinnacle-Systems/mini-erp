"use client";

export const STORE_CONTEXT_KEY = "mini_erp_store_context_v1";

export type AssignedStore = {
  id: string;
  name: string;
};

type StoreContextState = {
  activeStoreId: string | null;
  activeStoreName: string | null;
  pendingStoreId: string | null;
  assignedStores: AssignedStore[];
  updatedAt: number;
};

const getDefaultState = (): StoreContextState => ({
  activeStoreId: null,
  activeStoreName: null,
  pendingStoreId: null,
  assignedStores: [],
  updatedAt: Date.now(),
});

export const readStoreContext = (): StoreContextState => {
  try {
    const raw = window.localStorage.getItem(STORE_CONTEXT_KEY);
    if (!raw) {
      return getDefaultState();
    }

    const parsed = JSON.parse(raw) as StoreContextState;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("activeStoreId" in parsed) ||
      !("activeStoreName" in parsed) ||
      !("pendingStoreId" in parsed) ||
      !("assignedStores" in parsed)
    ) {
      return getDefaultState();
    }

    return {
      activeStoreId:
        typeof parsed.activeStoreId === "string" ? parsed.activeStoreId : null,
      activeStoreName:
        typeof parsed.activeStoreName === "string" ? parsed.activeStoreName : null,
      pendingStoreId:
        typeof parsed.pendingStoreId === "string" ? parsed.pendingStoreId : null,
      assignedStores: Array.isArray(parsed.assignedStores)
        ? parsed.assignedStores.filter(
          (store): store is AssignedStore =>
            typeof store === "object" &&
            store !== null &&
            typeof store.id === "string" &&
            typeof store.name === "string",
        )
        : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return getDefaultState();
  }
};

const writeStoreContext = (state: StoreContextState) => {
  window.localStorage.setItem(STORE_CONTEXT_KEY, JSON.stringify(state));
};

export const clearStoreContext = () => {
  window.localStorage.removeItem(STORE_CONTEXT_KEY);
};

export const getActiveStoreId = () => readStoreContext().activeStoreId;

export const getPendingStoreId = () => readStoreContext().pendingStoreId;

export const getAssignedStores = () => readStoreContext().assignedStores;

export const setAssignedStores = (stores: AssignedStore[]) => {
  const current = readStoreContext();
  const normalizedStores = stores
    .filter((store) => Boolean(store.id))
    .map((store) => ({
      id: store.id,
      name: store.name,
    }));

  const activeStore = normalizedStores.find(
    (store) => store.id === current.activeStoreId,
  );

  writeStoreContext({
    ...current,
    assignedStores: normalizedStores,
    activeStoreName: activeStore?.name ?? current.activeStoreName,
    updatedAt: Date.now(),
  });
};

export const setActiveStore = (storeId: string, storeName?: string | null) => {
  const current = readStoreContext();
  const matchedStore = current.assignedStores.find((store) => store.id === storeId);

  writeStoreContext({
    ...current,
    activeStoreId: storeId,
    activeStoreName: storeName ?? matchedStore?.name ?? null,
    updatedAt: Date.now(),
  });
};

export const queuePendingStoreSelection = (storeId: string) => {
  const current = readStoreContext();
  writeStoreContext({
    ...current,
    pendingStoreId: storeId,
    updatedAt: Date.now(),
  });
};

export const clearPendingStoreSelection = () => {
  const current = readStoreContext();
  writeStoreContext({
    ...current,
    pendingStoreId: null,
    updatedAt: Date.now(),
  });
};
