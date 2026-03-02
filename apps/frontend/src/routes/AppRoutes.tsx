import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { IconButton } from "../design-system/atoms/IconButton";
import { useSessionStore } from "../features/auth/session-business";
import { useLogoutFlow } from "../features/auth/useLogoutFlow";
import { useSyncActions } from "../features/sync/SyncProvider";
import { LoginPage } from "../pages/auth";
import { AppHomePage } from "../pages/shell";
import { AdminLayout } from "../pages/admin/layout";
import { AdminBusinessesPage, AdminBusinessDetailsPage } from "../pages/admin/businesses";
import { AdminUsersPage, AdminUserDetailsPage } from "../pages/admin/users";
import { CategoriesPage, CollectionsPage, PricingPage } from "../pages/catalog";
import { ItemsPage, AddItemPage, ItemDetailsPage } from "../pages/catalog/items";
import { AppFeaturePlaceholderPage, DataSyncAppPage, ItemSyncAppPage } from "../pages/shell/UserAppPages";
import { AdjustmentsPage, HistoryPage, LevelsPage } from "../pages/stock";
import { OfflinePage } from "../pages/system";
import { SessionHeader } from "../design-system/organisms/SessionHeader";
import { RequireAuth, RequireHydrated, RequireModule, RequireRole } from "./guards";

function AppEntryRoute() {
  const role = useSessionStore((state) => state.role);

  if (role === "PLATFORM_ADMIN") return <Navigate to="/app/businesses" replace />;
  return <AppHomePage />;
}

function AppLayout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);
  const { lastSyncError, clearSyncError } = useSyncActions();

  const isAuthenticated = Boolean(identityId);
  const isPlatformAdmin = role === "PLATFORM_ADMIN";
  const shouldShowUserBack =
    !isPlatformAdmin &&
    (/^\/app\/items\/new$/.test(location.pathname) ||
      /^\/app\/items\/[^/]+$/.test(location.pathname));
  const headerContext = (() => {
    if (!isPlatformAdmin) return null;
    const { pathname } = location;
    if (pathname === "/app/businesses") {
      return {
        title: "Manage Businesses",
        subtitle: "Browse, edit, and manage business records.",
      };
    }
    if (pathname === "/app/businesses/new") {
      return {
        title: "Add Business",
        subtitle: "Create a new business and initialize profile details.",
      };
    }
    if (pathname.startsWith("/app/businesses/")) {
      return {
        title: "Business Details",
        subtitle: "Manage business metadata and lifecycle state.",
      };
    }
    if (pathname === "/app/users") {
      return {
        title: "Manage Users",
        subtitle: "Review users and inspect account activity.",
      };
    }
    if (pathname.startsWith("/app/users/")) {
      return {
        title: "User Details",
        subtitle: "Inspect user profile data and account state.",
      };
    }
    return null;
  })();

  useEffect(() => {
    if (!isAuthenticated) {
      document.body.classList.remove("app-shell-locked");
      return;
    }

    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const applyLock = () => {
      if (desktopMedia.matches) {
        document.body.classList.add("app-shell-locked");
      } else {
        document.body.classList.remove("app-shell-locked");
      }
    };

    applyLock();
    desktopMedia.addEventListener("change", applyLock);

    return () => {
      desktopMedia.removeEventListener("change", applyLock);
      document.body.classList.remove("app-shell-locked");
    };
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen w-full lg:h-screen lg:overflow-hidden">
      {isAuthenticated ? (
        <div className="fixed inset-x-0 top-0 z-40 border-b border-border/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="px-2 py-2 sm:px-3 md:px-4">
            <SessionHeader
              showBack={shouldShowUserBack}
              showSwitchStore
              contextTitle={headerContext?.title}
              contextSubtitle={headerContext?.subtitle}
              onLogout={isPlatformAdmin ? onLogout : undefined}
            />
          </div>
          {lastSyncError ? (
            <div className="border-t border-red-200 bg-red-50/95 px-2 py-1.5 sm:px-3 md:px-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-red-700">{lastSyncError}</p>
                <IconButton
                  type="button"
                  icon={X}
                  onClick={clearSyncError}
                  className="h-5 w-5 shrink-0 rounded-full border-none bg-transparent p-0 text-red-700 shadow-none hover:bg-red-100"
                  aria-label="Dismiss sync error"
                  title="Dismiss sync error"
                  iconSize={14}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        className={`overflow-visible overflow-x-hidden lg:h-full lg:min-h-0 lg:overflow-hidden ${isAuthenticated ? (lastSyncError ? "pt-24 sm:pt-[6.5rem]" : "pt-14 sm:pt-16") : ""}`}
      >
        <Outlet />
      </div>
    </div>
  );
}

export function AppRoutes() {
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);
  const isHydratingSession = useSessionStore((state) => state.isHydratingSession);
  const { submit: onLogout } = useLogoutFlow();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const isAuthenticated = Boolean(identityId);

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);

    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);

    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  const shouldShowOfflinePage =
    !isHydratingSession && !isOnline && (role === "PLATFORM_ADMIN" || !isAuthenticated);

  if (shouldShowOfflinePage) return <OfflinePage />;

  return (
    <Routes>
      <Route element={<RequireHydrated />}>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/app" replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout onLogout={() => void onLogout()} />}>
            <Route path="/app" element={<AppEntryRoute />}>
              <Route element={<RequireRole role="USER" />}>
                <Route path="sales-bills" element={<AppFeaturePlaceholderPage sectionTitle="Sell" appLabel="Bills" />} />
                <Route path="sales-orders" element={<AppFeaturePlaceholderPage sectionTitle="Sell" appLabel="Orders" />} />
                <Route path="sales-returns" element={<AppFeaturePlaceholderPage sectionTitle="Sell" appLabel="Returns" />} />
                <Route element={<RequireModule moduleKey="pricing" />}>
                  <Route path="item-pricing" element={<PricingPage />} />
                </Route>
                <Route path="item-categories" element={<CategoriesPage />} />
                <Route path="item-collections" element={<CollectionsPage />} />
                <Route path="item-sync" element={<Navigate to="/app/admin-item-sync" replace />} />
                <Route path="stock-levels" element={<LevelsPage />} />
                <Route path="stock-adjustments" element={<AdjustmentsPage />} />
                <Route path="stock-history" element={<HistoryPage />} />
                <Route path="customers" element={<AppFeaturePlaceholderPage sectionTitle="People" appLabel="Customers" />} />
                <Route path="customer-groups" element={<AppFeaturePlaceholderPage sectionTitle="People" appLabel="Groups" />} />
                <Route path="suppliers" element={<AppFeaturePlaceholderPage sectionTitle="People" appLabel="Suppliers" />} />
                <Route path="promo-rules" element={<AppFeaturePlaceholderPage sectionTitle="Promotions" appLabel="Rules" />} />
                <Route path="promo-bundles" element={<AppFeaturePlaceholderPage sectionTitle="Promotions" appLabel="Bundles" />} />
                <Route path="promo-codes" element={<AppFeaturePlaceholderPage sectionTitle="Promotions" appLabel="Codes" />} />
                <Route path="sales-report" element={<AppFeaturePlaceholderPage sectionTitle="Reports" appLabel="Sales" />} />
                <Route path="top-items-report" element={<AppFeaturePlaceholderPage sectionTitle="Reports" appLabel="Top Items" />} />
                <Route path="stock-value-report" element={<AppFeaturePlaceholderPage sectionTitle="Reports" appLabel="Stock Value" />} />
                <Route path="settings" element={<AppFeaturePlaceholderPage sectionTitle="Admin" appLabel="Business Settings" />} />
                <Route path="admin-item-sync" element={<ItemSyncAppPage />} />
                <Route path="data-sync" element={<DataSyncAppPage />} />
                <Route path="items" element={<ItemsPage />} />
                <Route path="items/new" element={<AddItemPage />} />
                <Route path="items/:itemId" element={<ItemDetailsPage />} />
              </Route>
            </Route>

            <Route element={<RequireRole role="PLATFORM_ADMIN" />}>
              <Route element={<AdminLayout />}>
                <Route path="/app/businesses" element={<AdminBusinessesPage mode="list" />} />
                <Route path="/app/businesses/new" element={<AdminBusinessesPage mode="new" />} />
                <Route path="/app/businesses/:businessId" element={<AdminBusinessDetailsPage />} />
                <Route path="/app/users" element={<AdminUsersPage />} />
                <Route path="/app/users/:userId" element={<AdminUserDetailsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/app" : "/login"} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/app" : "/login"} replace />}
        />
      </Route>
    </Routes>
  );
}
