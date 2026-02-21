import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminStoresStore } from "../admin/admin-stores-store";
import { useUserAppStore } from "../sync/user-app-store";
import { logout } from "./client";
import { clearSessionStoreContext, useSessionStore } from "./session-store";

export function useLogoutFlow() {
  const navigate = useNavigate();
  const clearSession = useSessionStore((state) => state.clearSession);
  const resetUserAppState = useUserAppStore((state) => state.resetUserAppState);
  const resetAdminStoresState = useAdminStoresStore(
    (state) => state.resetAdminStoresState,
  );
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      await logout();
      clearSessionStoreContext();
      clearSession();
      resetUserAppState();
      resetAdminStoresState();
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return { loading, submit };
}
