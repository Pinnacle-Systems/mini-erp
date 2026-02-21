import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { selectStore } from "../features/auth/client";
import { useSessionStore } from "../features/auth/session-store";
import { StorePanel } from "../design-system/organisms/StorePanel";

export function StoreSelectionPage() {
  const navigate = useNavigate();
  const stores = useSessionStore((state) => state.stores);
  const activeStore = useSessionStore((state) => state.activeStore);
  const setActiveStore = useSessionStore((state) => state.setActiveStore);
  const setIsStoreSelected = useSessionStore((state) => state.setIsStoreSelected);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);
  const identityId = useSessionStore((state) => state.identityId);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(activeStore ?? "");
  const isAuthenticated = Boolean(identityId);
  const activeStoreName = useMemo(
    () =>
      stores.find((store) => store.id === activeStore)?.name ??
      "No store selected",
    [activeStore, stores],
  );
  const currentStoreReminder =
    isStoreSelected && activeStore ? activeStoreName : null;

  useEffect(() => {
    setSelectedStore(activeStore ?? "");
  }, [activeStore]);

  const onStoreChange = (storeId: string) => {
    setSelectedStore(storeId);
  };

  const onApplyStoreToken = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      await selectStore(selectedStore);
      setActiveStore(selectedStore);
      setIsStoreSelected(true);
      navigate("/app", { replace: true });
    } catch (error) {
      const isNetworkFailure =
        !navigator.onLine || error instanceof TypeError;

      if (isAuthenticated && isNetworkFailure) {
        setActiveStore(selectedStore);
        setIsStoreSelected(true);
        navigate("/app", { replace: true });
        return;
      }

      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-4 p-6 md:p-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">
          Select a store
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose the store you want to access for this session.
        </p>
      </header>
      <StorePanel
        stores={stores}
        activeStore={selectedStore}
        currentStoreReminder={currentStoreReminder}
        loading={loading}
        isAuthenticated={isAuthenticated}
        onStoreChange={onStoreChange}
        onApplyStoreToken={onApplyStoreToken}
      />
    </main>
  );
}
