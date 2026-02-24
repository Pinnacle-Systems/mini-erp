import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { selectStore } from "../features/auth/client";
import { useSessionStore } from "../features/auth/session-business";
import { BusinessPanel } from "../design-system/organisms/BusinessPanel";

export function BusinessSelectionPage() {
  const navigate = useNavigate();
  const businesses = useSessionStore((state) => state.businesses);
  const activeStore = useSessionStore((state) => state.activeStore);
  const setActiveStore = useSessionStore((state) => state.setActiveStore);
  const setActiveBusinessModules = useSessionStore((state) => state.setActiveBusinessModules);
  const setIsBusinessSelected = useSessionStore((state) => state.setIsBusinessSelected);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const identityId = useSessionStore((state) => state.identityId);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(activeStore ?? "");
  const isAuthenticated = Boolean(identityId);
  const activeBusinessName = useMemo(
    () =>
      businesses.find((business) => business.id === activeStore)?.name ??
      "No business selected",
    [activeStore, businesses],
  );
  const currentBusinessReminder =
    isBusinessSelected && activeStore ? activeBusinessName : null;

  useEffect(() => {
    setSelectedStore(activeStore ?? "");
  }, [activeStore]);

  const onBusinessChange = (businessId: string) => {
    setSelectedStore(businessId);
  };

  const onApplyBusinessToken = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const result = await selectStore(selectedStore);
      setActiveStore(selectedStore);
      setActiveBusinessModules(result.modules ?? null);
      setIsBusinessSelected(true);
      navigate("/app", { replace: true });
    } catch (error) {
      const isNetworkFailure =
        !navigator.onLine || error instanceof TypeError;

      if (isAuthenticated && isNetworkFailure) {
        setActiveStore(selectedStore);
        setIsBusinessSelected(true);
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
          Select a business
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose the business you want to access for this session.
        </p>
      </header>
      <BusinessPanel
        businesses={businesses}
        activeStore={selectedStore}
        currentBusinessReminder={currentBusinessReminder}
        loading={loading}
        isAuthenticated={isAuthenticated}
        onBusinessChange={onBusinessChange}
        onApplyBusinessToken={onApplyBusinessToken}
      />
    </main>
  );
}
