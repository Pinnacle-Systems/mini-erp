"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { readAuthCache, writeAuthCache } from "@/features/auth/client/state";

type ClientAuthGateProps = {
  children: ReactNode;
};

type GateStatus = "checking" | "allow" | "deny";

const LOGIN_PATH = "/login";
const OFFLINE_PATH = "/offline";

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
  const [status, setStatus] = useState<GateStatus>(() => {
    if (typeof window === "undefined") {
      return "checking";
    }

    if (!window.navigator.onLine) {
      return getOfflineStatus(isLoginRoute, isOfflineRoute);
    }

    return "checking";
  });

  const redirectTarget = useMemo(() => {
    if (status !== "deny") {
      return null;
    }
    if (isOfflineRoute) {
      return null;
    }
    return isLoginRoute ? "/" : LOGIN_PATH;
  }, [isLoginRoute, isOfflineRoute, status]);

  useEffect(() => {
    let isCancelled = false;

    const evaluate = async () => {
      if (isOfflineRoute) {
        if (!isCancelled) {
          setStatus("allow");
        }
        return;
      }

      if (!window.navigator.onLine) {
        if (!isCancelled) {
          setStatus(getOfflineStatus(isLoginRoute, isOfflineRoute));
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
          if (isLoginRoute) {
            setStatus(isAuthenticated ? "deny" : "allow");
          } else {
            setStatus(isAuthenticated ? "allow" : "deny");
          }
        }
      } catch {
        if (!isCancelled) {
          setStatus(getOfflineStatus(isLoginRoute, isOfflineRoute));
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
  }, [isLoginRoute, isOfflineRoute, pathname]);

  useEffect(() => {
    if (!redirectTarget) {
      return;
    }
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (status === "checking" || status === "deny") {
    return null;
  }

  return <>{children}</>;
}
