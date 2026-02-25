import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { selectStore } from "../features/auth/client";
import { useSessionStore } from "../features/auth/session-business";
import { BusinessPanel } from "../design-system/organisms/BusinessPanel";
import { canSwitchStoreOffline } from "../features/auth/license-policy";

export function BusinessSelectionPage() {
  const navigate = useNavigate();
  const businesses = useSessionStore((state) => state.businesses);
  const activeStore = useSessionStore((state) => state.activeStore);
  const setActiveStore = useSessionStore((state) => state.setActiveStore);
  const setActiveBusinessModules = useSessionStore((state) => state.setActiveBusinessModules);
  const setStoreNeedsOnlineLicenseValidation = useSessionStore(
    (state) => state.setStoreNeedsOnlineLicenseValidation,
  );
  const setIsBusinessSelected = useSessionStore((state) => state.setIsBusinessSelected);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const identityId = useSessionStore((state) => state.identityId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setSelectedStore(businessId);
  };

  const onApplyBusinessToken = async () => {
    if (!selectedStore) return;
    setLoading(true);
    setError(null);
    try {
      const result = await selectStore(selectedStore);
      setActiveStore(selectedStore);
      setActiveBusinessModules(result.modules ?? null);
      setStoreNeedsOnlineLicenseValidation(selectedStore, false);
      setIsBusinessSelected(true);
      navigate("/app", { replace: true });
    } catch (error) {
      const isNetworkFailure =
        !navigator.onLine || error instanceof TypeError;

      if (isAuthenticated && isNetworkFailure) {
        const selectedBusiness = businesses.find((business) => business.id === selectedStore);
        const offlinePolicy = canSwitchStoreOffline(selectedBusiness);
        if (!offlinePolicy.allowed) {
          setError(offlinePolicy.reason ?? "Store cannot be selected offline.");
          return;
        }
        setActiveStore(selectedStore);
        setStoreNeedsOnlineLicenseValidation(selectedStore, true);
        setIsBusinessSelected(true);
        navigate("/app", { replace: true });
        return;
      }

      setError(error instanceof Error ? error.message : "Unable to select business.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto h-auto w-full max-w-4xl space-y-3 p-3 pb-20 sm:p-4 sm:pb-24 lg:h-full lg:min-h-0 lg:pb-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
          Select a business
        </h1>
        <p className="text-xs text-muted-foreground">
          Choose the business you want to access for this session.
        </p>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
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
