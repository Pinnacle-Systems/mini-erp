import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionHydration } from "./SessionProvider";
import { login } from "./client";
import {
  clearSessionStoreContext,
  useSessionStore,
} from "./session-store";

type Credentials = {
  username: string;
  password: string;
};

export function useLoginFlow() {
  const navigate = useNavigate();
  const { refreshSession } = useSessionHydration();
  const setSessionActiveStore = useSessionStore((state) => state.setActiveStore);
  const setSessionStoreSelected = useSessionStore(
    (state) => state.setIsStoreSelected,
  );
  const [loading, setLoading] = useState(false);

  const submit = async ({ username, password }: Credentials) => {
    setLoading(true);

    try {
      await login(username, password);
      clearSessionStoreContext();
      setSessionActiveStore(null);
      setSessionStoreSelected(false);

      const me = await refreshSession();
      if (!me?.identityId) {
        return;
      }

      if (me.role === "USER" && !me.tenantId) {
        navigate("/app/select-store", { replace: true });
        return;
      }

      navigate("/app", { replace: true });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return { loading, submit };
}
