import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSessionHydration } from "../features/auth/SessionProvider";
import { useSessionStore } from "../features/auth/session-business";
import { useSyncActions } from "../features/sync/SyncProvider";
import {
  addAppStateListener,
  addBackButtonListener,
  addNetworkListener,
  exitNativeApp,
  isNativeAndroidApp,
} from "./capacitor";
import { runStorageDiagnostics } from "./storage-diagnostics";

type MobilePlatformBridgeProps = {
  children: ReactNode;
};

export function MobilePlatformBridge({ children }: MobilePlatformBridgeProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useSessionHydration();
  const { onSyncNow } = useSyncActions();
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const isHydratingSession = useSessionStore((state) => state.isHydratingSession);
  const role = useSessionStore((state) => state.role);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    void runStorageDiagnostics();
  }, []);

  useEffect(() => {
    const syncIfReady = async () => {
      if (
        isSyncingRef.current ||
        isHydratingSession ||
        role !== "USER" ||
        !activeStore ||
        !isBusinessSelected
      ) {
        return;
      }

      isSyncingRef.current = true;
      try {
        await refreshSession();
        await onSyncNow();
      } finally {
        isSyncingRef.current = false;
      }
    };

    const removeAppStateListener = addAppStateListener(({ isActive }) => {
      if (!isActive) {
        return;
      }
      void syncIfReady();
    });

    const removeNetworkListener = addNetworkListener(({ connected }) => {
      if (!connected) {
        return;
      }
      void syncIfReady();
    });

    return () => {
      removeAppStateListener();
      removeNetworkListener();
    };
  }, [activeStore, isBusinessSelected, isHydratingSession, onSyncNow, refreshSession, role]);

  useEffect(() => {
    if (!isNativeAndroidApp()) {
      return;
    }

    return addBackButtonListener(({ canGoBack }) => {
      if (canGoBack || location.pathname !== "/app") {
        navigate(-1);
        return;
      }

      exitNativeApp();
    });
  }, [location.pathname, navigate]);

  return <>{children}</>;
}
