import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionHydration } from "./SessionProvider";
import { login } from "./client";
import {
  clearSessionBusinessContext,
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
  const setSessionBusinessSelected = useSessionStore(
    (state) => state.setIsBusinessSelected,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async ({ username, password }: Credentials) => {
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      clearSessionBusinessContext();
      setSessionActiveStore(null);
      setSessionBusinessSelected(false);

      const me = await refreshSession();
      if (!me?.identityId) {
        return;
      }

      if (me.role === "USER" && !me.tenantId) {
        navigate("/app/select-business", { replace: true });
        return;
      }

      navigate("/app", { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return { loading, submit, error };
}
