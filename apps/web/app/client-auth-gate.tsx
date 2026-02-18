"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { readAuthCache, writeAuthCache } from "@/features/auth/client/state";

type ClientAuthGateProps = {
  children: ReactNode;
};

type GateStatus = "checking" | "allow" | "deny";
type MeResponse = {
  success: boolean;
  role?: string | null;
  tenantId?: string | null;
};

const LOGIN_PATH = "/login";
const OFFLINE_PATH = "/offline";
const STORE_SELECTION_PATH = "/store-selection";

const getOfflineStatus = (isLoginRoute: boolean, isOfflineRoute: boolean): GateStatus => {
  if (isOfflineRoute) {
    return "allow";
  }

  const hasCachedAuth = Boolean(readAuthCache()?.isAuthenticated);
  if (isLoginRoute) {
    return hasCachedAuth ? "deny" : "allow";
  }
  return hasCachedAuth ? "allow" : "deny";
};

export default function ClientAuthGate({ children }: ClientAuthGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === LOGIN_PATH;
  const isOfflineRoute = pathname === OFFLINE_PATH;
  const isStoreSelectionRoute = pathname === STORE_SELECTION_PATH;
  const [status, setStatus] = useState<GateStatus>(() => {
    if (typeof window === "undefined") {
      return "checking";
    }

    if (!window.navigator.onLine) {
      return getOfflineStatus(isLoginRoute, isOfflineRoute);
    }

    return "checking";
  });
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  const fallbackRedirectTarget = useMemo(() => {
    if (isOfflineRoute || status !== "deny") {
      return null;
    }
    return isLoginRoute ? "/" : LOGIN_PATH;
  }, [isLoginRoute, isOfflineRoute, status]);

  useEffect(() => {
    let isCancelled = false;

    const evaluate = async () => {
      let nextRedirectTarget: string | null = null;

      if (isOfflineRoute) {
        if (!isCancelled) {
          setStatus("allow");
          setRedirectTarget(null);
        }
        return;
      }

      if (!window.navigator.onLine) {
        if (!isCancelled) {
          setStatus(getOfflineStatus(isLoginRoute, isOfflineRoute));
          setRedirectTarget(null);
        }
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        const isAuthenticated = response.ok;
        writeAuthCache(isAuthenticated);

        if (!isCancelled) {
          if (!isAuthenticated) {
            setStatus(isLoginRoute ? "allow" : "deny");
            setRedirectTarget(null);
            return;
          }

          const payload = (await response.json()) as MeResponse;
          const isNonAdminWithoutStore =
            payload.role === "USER" && !payload.tenantId;

          if (isLoginRoute) {
            nextRedirectTarget = isNonAdminWithoutStore ? STORE_SELECTION_PATH : "/";
            setStatus("deny");
          } else if (isStoreSelectionRoute) {
            if (isNonAdminWithoutStore) {
              setStatus("allow");
            } else {
              nextRedirectTarget = "/";
              setStatus("deny");
            }
          } else if (isNonAdminWithoutStore) {
            nextRedirectTarget = STORE_SELECTION_PATH;
            setStatus("deny");
          } else {
            setStatus("allow");
          }

          setRedirectTarget(nextRedirectTarget);
        }
      } catch {
        if (!isCancelled) {
          setStatus(getOfflineStatus(isLoginRoute, isOfflineRoute));
          setRedirectTarget(null);
        }
      }
    };

    void evaluate();

    const handleConnectivityChange = () => {
      void evaluate();
    };

    window.addEventListener("online", handleConnectivityChange);
    window.addEventListener("offline", handleConnectivityChange);

    return () => {
      isCancelled = true;
      window.removeEventListener("online", handleConnectivityChange);
      window.removeEventListener("offline", handleConnectivityChange);
    };
  }, [isLoginRoute, isOfflineRoute, isStoreSelectionRoute, pathname]);

  useEffect(() => {
    const target = redirectTarget ?? fallbackRedirectTarget;
    if (!target) {
      return;
    }
    router.replace(target);
  }, [fallbackRedirectTarget, redirectTarget, router]);

  if (status === "checking" || status === "deny") {
    return null;
  }

  return <>{children}</>;
}
