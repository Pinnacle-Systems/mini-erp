export const STORE_CONTEXT_KEY = "mini_erp_store_context_v1";

export type AssignedStore = {
  id: string;
  name: string;
};

type StoreContextState = {
  activeStoreId: string | null;
  activeStoreName: string | null;
  assignedStores: AssignedStore[];
  updatedAt: number;
};

const defaultState = (): StoreContextState => ({
  activeStoreId: null,
  activeStoreName: null,
  assignedStores: [],
  updatedAt: Date.now()
});

export const readStoreContext = (): StoreContextState => {
  try {
    const raw = window.localStorage.getItem(STORE_CONTEXT_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<StoreContextState>;
    return {
      activeStoreId: typeof parsed.activeStoreId === "string" ? parsed.activeStoreId : null,
      activeStoreName:
        typeof parsed.activeStoreName === "string" ? parsed.activeStoreName : null,
      assignedStores: Array.isArray(parsed.assignedStores)
        ? parsed.assignedStores.filter(
            (store): store is AssignedStore =>
              typeof store === "object" &&
              store !== null &&
              typeof store.id === "string" &&
              typeof store.name === "string"
          )
        : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now()
    };
  } catch {
    return defaultState();
  }
};

const writeStoreContext = (state: StoreContextState) => {
  window.localStorage.setItem(STORE_CONTEXT_KEY, JSON.stringify(state));
};

export const setAssignedStores = (stores: AssignedStore[]) => {
  const current = readStoreContext();
  const active = stores.find((store) => store.id === current.activeStoreId) ?? null;

  writeStoreContext({
    activeStoreId: active?.id ?? null,
    activeStoreName: active?.name ?? null,
    assignedStores: stores,
    updatedAt: Date.now()
  });
};

export const setActiveStore = (storeId: string) => {
  const current = readStoreContext();
  const matched = current.assignedStores.find((store) => store.id === storeId) ?? null;

  writeStoreContext({
    ...current,
    activeStoreId: storeId,
    activeStoreName: matched?.name ?? null,
    updatedAt: Date.now()
  });
};

export const getActiveStoreId = () => readStoreContext().activeStoreId;
export const getAssignedStores = () => readStoreContext().assignedStores;

export const clearStoreContext = () => {
  writeStoreContext(defaultState());
};
