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
  phoneNumber: string;
  password: string;
};

export function useLoginFlow() {
  const navigate = useNavigate();
  const { refreshSession } = useSessionHydration();
  const setSessionActiveStore = useSessionStore((state) => state.setActiveStore);
  const setSessionActiveBusinessModules = useSessionStore(
    (state) => state.setActiveBusinessModules,
  );
  const setSessionActiveLocation = useSessionStore((state) => state.setActiveLocation);
  const setSessionActiveMemberRole = useSessionStore((state) => state.setActiveMemberRole);
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

  const submit = async ({ phoneNumber, password }: Credentials) => {
    setError(null);
    setLoading(true);

    try {
      const auth = await login(phoneNumber, password);
      clearSessionBusinessContext();
      setSessionActiveStore(null);
      setSessionBusinessSelected(false);

      if (auth.role === "USER") {
        const availableBusinesses = auth.availableStores ?? [];
        if (availableBusinesses.length === 0) {
          const me = await refreshSession();
          if (!me?.identityId) return;
          if (me.role === "USER" && !me.tenantId) {
            const businesses = me.businesses ?? [];
            if (businesses.length === 1) {
              await selectPendingBusiness(businesses[0].id);
              return;
            }
            setPendingBusinesses(businesses);
            return;
          }
          navigate("/app", { replace: true });
          return;
        }
        if (availableBusinesses.length === 1) {
          await selectPendingBusiness(availableBusinesses[0].id);
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
        const businesses = me.businesses ?? [];
        if (businesses.length === 1) {
          await selectPendingBusiness(businesses[0].id);
          return;
        }
        setPendingBusinesses(businesses);
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
      setSessionActiveLocation(businessId, result.activeLocationId ?? null);
      setSessionActiveMemberRole(result.memberRole ?? null);
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
    setSessionActiveMemberRole(null);
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
