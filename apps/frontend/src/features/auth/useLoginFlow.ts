import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionHydration } from "./SessionProvider";
import { login, selectStore } from "./client";
import {
  clearSessionBusinessContext,
  type AssignedStore,
  useSessionStore,
} from "./session-business";

type Credentials = {
  username: string;
  password: string;
};

export function useLoginFlow() {
  const navigate = useNavigate();
  const { refreshSession } = useSessionHydration();
  const setSessionActiveStore = useSessionStore((state) => state.setActiveStore);
  const setSessionActiveBusinessModules = useSessionStore(
    (state) => state.setActiveBusinessModules,
  );
  const setStoreNeedsOnlineLicenseValidation = useSessionStore(
    (state) => state.setStoreNeedsOnlineLicenseValidation,
  );
  const setSessionBusinessSelected = useSessionStore(
    (state) => state.setIsBusinessSelected,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingBusinesses, setPendingBusinesses] = useState<AssignedStore[] | null>(null);
  const [selectingBusiness, setSelectingBusiness] = useState(false);

  const submit = async ({ username, password }: Credentials) => {
    setError(null);
    setLoading(true);

    try {
      const auth = await login(username, password);
      clearSessionBusinessContext();
      setSessionActiveStore(null);
      setSessionBusinessSelected(false);

      if (auth.role === "USER") {
        const availableBusinesses = auth.availableStores ?? [];
        if (availableBusinesses.length === 0) {
          const me = await refreshSession();
          if (!me?.identityId) return;
          if (me.role === "USER" && !me.tenantId) {
            setPendingBusinesses(me.businesses ?? []);
            return;
          }
          navigate("/app", { replace: true });
          return;
        }
        setPendingBusinesses(availableBusinesses);
        return;
      }

      const me = await refreshSession();
      if (!me?.identityId) {
        return;
      }

      if (me.role === "USER" && !me.tenantId) {
        setPendingBusinesses(me.businesses ?? []);
        return;
      }

      navigate("/app", { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  const selectPendingBusiness = async (businessId: string) => {
    setLoading(true);
    setSelectingBusiness(true);
    setError(null);
    try {
      const result = await selectStore(businessId);
      setSessionActiveStore(businessId);
      setSessionActiveBusinessModules(result.modules ?? null);
      setStoreNeedsOnlineLicenseValidation(businessId, false);
      setSessionBusinessSelected(true);
      await refreshSession();
      setPendingBusinesses(null);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to select business.");
    } finally {
      setLoading(false);
      setSelectingBusiness(false);
    }
  };

  const cancelPendingBusinessSelection = () => {
    setPendingBusinesses(null);
    setSessionActiveStore(null);
    setSessionBusinessSelected(false);
  };

  return {
    loading,
    submit,
    error,
    pendingBusinesses,
    selectingBusiness,
    selectPendingBusiness,
    cancelPendingBusinessSelection,
  };
}
