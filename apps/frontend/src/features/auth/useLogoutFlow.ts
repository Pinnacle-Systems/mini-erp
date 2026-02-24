import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminBusinessesStore } from "../admin/admin-businesses-store";
import { useUserAppStore } from "../sync/user-app-business";
import { logout } from "./client";
import { clearSessionBusinessContext, useSessionStore } from "./session-business";

export function useLogoutFlow() {
  const navigate = useNavigate();
  const clearSession = useSessionStore((state) => state.clearSession);
  const resetUserAppState = useUserAppStore((state) => state.resetUserAppState);
  const resetAdminBusinessesState = useAdminBusinessesStore(
    (state) => state.resetAdminBusinessesState,
  );
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) {
      return;
    }

    if (!navigator.onLine) {
      const shouldContinue = window.confirm(
        "You are offline. If you log out now, you may not be able to log in again until network connectivity is restored. Continue?",
      );
      if (!shouldContinue) {
        return;
      }
    }

    setLoading(true);
    try {
      await logout();
      clearSessionBusinessContext();
      clearSession();
      resetUserAppState();
      resetAdminBusinessesState();
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return { loading, submit };
}
