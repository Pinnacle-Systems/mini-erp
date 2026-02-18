"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { writeAuthCache } from "@/features/auth/client/state";
import {
  getActiveStoreId,
  clearPendingStoreSelection,
  clearStoreContext,
  getAssignedStores,
  getPendingStoreId,
  queuePendingStoreSelection,
  setActiveStore,
  setAssignedStores,
} from "@/features/auth/client/store-context";
import { ensureFreshAccessToken } from "@/features/auth/client/session";

type AppShellProps = {
  children: ReactNode;
};

const ADMIN_ROLE = "PLATFORM_ADMIN";
const USER_ROLE = "USER";
const ADMIN_AUTO_REFRESH_INTERVAL_MS = 240_000;
const ADMIN_ACTIVE_WINDOW_MS = 60_000;
const STORE_SELECTION_PATH = "/store-selection";
const MANAGE_USERS_PATH = "/manage-users";
const OWNER_MEMBER_ROLE = "OWNER";
const MANAGER_MEMBER_ROLE = "MANAGER";

type Store = {
  id: string;
  name: string;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [currentStoreName, setCurrentStoreName] = useState<string | null>(null);
  const [isStorePickerOpen, setIsStorePickerOpen] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [isSwitchingStoreId, setIsSwitchingStoreId] = useState<string | null>(null);
  const [pendingStoreId, setPendingStoreId] = useState<string | null>(null);
  const lastInteractionAtRef = useRef(Date.now());

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Continue with local sign-out when offline/unreachable.
    } finally {
      writeAuthCache(false);
      clearStoreContext();
      router.replace("/login");
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadMe = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          success: boolean;
          role?: string | null;
          tenantId?: string | null;
          memberRole?: string | null;
        };

        if (active && payload.success) {
          setRole(payload.role ?? null);
          setTenantId(payload.tenantId ?? null);
          setMemberRole(payload.memberRole ?? null);
          setPendingStoreId(getPendingStoreId());
        }
      } catch {
        const cachedStoreId = getActiveStoreId();
        if (active && cachedStoreId) {
          setRole(USER_ROLE);
          setTenantId(cachedStoreId);
          setMemberRole(null);
          setPendingStoreId(getPendingStoreId());
          const cachedStore = getAssignedStores().find((store) => store.id === cachedStoreId);
          setCurrentStoreName(cachedStore?.name ?? null);
        }
      }
    };

    void loadMe();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (role !== ADMIN_ROLE) {
      return;
    }

    if (
      pathname === "/login" ||
      pathname === "/offline" ||
      pathname === STORE_SELECTION_PATH
    ) {
      return;
    }

    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const maybeRefresh = () => {
      if (isLoggingOut) {
        return;
      }

      if (document.hidden) {
        return;
      }

      if (!window.navigator.onLine) {
        return;
      }

      const elapsedSinceInteraction = Date.now() - lastInteractionAtRef.current;
      if (elapsedSinceInteraction > ADMIN_ACTIVE_WINDOW_MS) {
        return;
      }

      void fetch("/api/auth/refresh", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      }).then((response) => {
        if (!response.ok && response.status === 401) {
          writeAuthCache(false);
          router.replace("/login");
        }
      }).catch(() => {
        // Ignore transient failures; refresh resumes on next interval.
      });
    };

    const interactionEvents: Array<keyof WindowEventMap> = [
      "focus",
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, markInteraction, { passive: true });
    });

    const refreshInterval = window.setInterval(
      maybeRefresh,
      ADMIN_AUTO_REFRESH_INTERVAL_MS,
    );

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markInteraction);
      });
      window.clearInterval(refreshInterval);
    };
  }, [isLoggingOut, pathname, role, router]);

  useEffect(() => {
    if (role !== USER_ROLE || !tenantId) {
      setCurrentStoreName(null);
      return;
    }

    let active = true;

    const resolveCurrentStore = async () => {
      try {
        const response = await fetch("/api/auth/stores", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        const payload = (await response.json()) as {
          success: boolean;
          stores?: Store[];
        };

        if (!response.ok || !payload.success) {
          return;
        }

        const assignedStores = payload.stores ?? [];
        setAssignedStores(assignedStores);

        const matchedStore = assignedStores.find((store) => store.id === tenantId);
        if (active) {
          setCurrentStoreName(matchedStore?.name ?? null);
        }
      } catch {
        // Keep shell rendering even if store name lookup fails.
      }
    };

    void resolveCurrentStore();

    return () => {
      active = false;
    };
  }, [role, tenantId]);

  useEffect(() => {
    if (role !== USER_ROLE) {
      return;
    }

    const reconcilePendingSelection = async () => {
      if (!window.navigator.onLine) {
        return;
      }

      const status = await ensureFreshAccessToken({ force: true });
      if (status !== "ok") {
        return;
      }

      const nextPendingStoreId = getPendingStoreId();
      setPendingStoreId(nextPendingStoreId);
      if (nextPendingStoreId) {
        return;
      }

      const storesFromCache = getAssignedStores();
      const selectedStore = tenantId
        ? storesFromCache.find((store) => store.id === tenantId)
        : null;
      if (selectedStore) {
        setCurrentStoreName(selectedStore.name);
      }
    };

    void reconcilePendingSelection();

    const handleOnline = () => {
      void reconcilePendingSelection();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [role, tenantId]);

  const openStorePicker = async () => {
    if (isLoadingStores || isSwitchingStoreId) {
      return;
    }

    setIsStorePickerOpen(true);
    setIsLoadingStores(true);
    setStoresError(null);

    if (!window.navigator.onLine) {
      const cachedStores = getAssignedStores();
      setStores(cachedStores);
      const matchedStore = tenantId
        ? cachedStores.find((store) => store.id === tenantId)
        : null;
      setCurrentStoreName(matchedStore?.name ?? null);
      setIsLoadingStores(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/stores", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        stores?: Store[];
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Unable to load assigned stores.");
      }

      const assignedStores = payload.stores ?? [];
      setStores(assignedStores);
      setAssignedStores(assignedStores);
      const matchedStore = tenantId
        ? assignedStores.find((store) => store.id === tenantId)
        : null;
      setCurrentStoreName(matchedStore?.name ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load assigned stores.";
      setStoresError(message);
    } finally {
      setIsLoadingStores(false);
    }
  };

  const handleSwitchStore = async (storeId: string) => {
    if (isSwitchingStoreId || storeId === tenantId) {
      setIsStorePickerOpen(false);
      return;
    }

    setIsSwitchingStoreId(storeId);
    setStoresError(null);

    const selectedStore = stores.find((store) => store.id === storeId);

    if (!window.navigator.onLine) {
      setActiveStore(storeId, selectedStore?.name ?? null);
      queuePendingStoreSelection(storeId);
      setTenantId(storeId);
      setCurrentStoreName(selectedStore?.name ?? null);
      setPendingStoreId(storeId);
      setStoresError("Store switch will sync when you are back online.");
      setIsSwitchingStoreId(null);
      setIsStorePickerOpen(false);
      router.refresh();
      return;
    }

    try {
      const response = await fetch("/api/auth/store-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storeId }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        memberRole?: string | null;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Unable to switch store.");
      }

      setActiveStore(storeId, selectedStore?.name ?? null);
      clearPendingStoreSelection();
      setPendingStoreId(null);
      setTenantId(storeId);
      setMemberRole(payload.memberRole ?? null);
      setCurrentStoreName(selectedStore?.name ?? null);
      setIsStorePickerOpen(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to switch store.";
      setStoresError(message);
    } finally {
      setIsSwitchingStoreId(null);
    }
  };

  if (
    pathname === "/login" ||
    pathname === "/offline" ||
    pathname === STORE_SELECTION_PATH
  ) {
    return <>{children}</>;
  }

  const canManageUsers =
    role === USER_ROLE &&
    Boolean(tenantId) &&
    (memberRole === OWNER_MEMBER_ROLE || memberRole === MANAGER_MEMBER_ROLE);

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between px-3">
          <Link
            href="/"
            className="rounded-md px-2 py-1 text-sm font-semibold tracking-wide text-slate-900 transition hover:bg-slate-100"
          >
            Mini ERP
          </Link>
          <div className="flex items-center gap-2">
            {role === ADMIN_ROLE ? (
              <div className="rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white">
                Admin Console
              </div>
            ) : null}
            {role === USER_ROLE && currentStoreName ? (
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300">
                Store: {currentStoreName}
              </div>
            ) : null}
            {role === USER_ROLE && pendingStoreId ? (
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-300">
                Pending Sync
              </div>
            ) : null}
            {role === USER_ROLE && tenantId ? (
              <button
                type="button"
                onClick={() => void openStorePicker()}
                disabled={isLoadingStores || Boolean(isSwitchingStoreId)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Switch Store
              </button>
            ) : null}
            {canManageUsers ? (
              <Link
                href={MANAGE_USERS_PATH}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Manage Users
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-center gap-2 px-3">
          <Link
            href="/"
            className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Dashboard
          </Link>
          {role === USER_ROLE && tenantId ? (
            <button
              type="button"
              onClick={() => void openStorePicker()}
              disabled={isLoadingStores || Boolean(isSwitchingStoreId)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Switch Store
            </button>
          ) : null}
          {canManageUsers ? (
            <Link
              href={MANAGE_USERS_PATH}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Manage Users
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </nav>

      {isStorePickerOpen ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center">
          <section className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Switch Store</h2>
              <button
                type="button"
                onClick={() => setIsStorePickerOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {storesError ? <p className="mt-2 text-sm text-red-600">{storesError}</p> : null}

            {isLoadingStores ? (
              <p className="mt-3 text-sm text-slate-600">Loading stores...</p>
            ) : stores.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No assigned stores found.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => void handleSwitchStore(store.id)}
                    disabled={Boolean(isSwitchingStoreId)}
                    className="flex h-11 items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{store.name}</span>
                    <span className="text-xs text-slate-500">
                      {store.id === tenantId
                        ? "Current"
                        : isSwitchingStoreId === store.id
                          ? "Switching..."
                          : "Switch"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
