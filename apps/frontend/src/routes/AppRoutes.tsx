import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useSessionStore } from "../features/auth/session-business";
import { useLogoutFlow } from "../features/auth/useLogoutFlow";
import { LoginPage } from "../pages/LoginPage";
import { AppHomePage } from "../pages/AppHomePage";
import { AdminLayout } from "../pages/AdminLayout";
import { AdminBusinessesPage } from "../pages/AdminBusinessesPage";
import { AdminBusinessDetailsPage } from "../pages/AdminBusinessDetailsPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { AdminUserDetailsPage } from "../pages/AdminUserDetailsPage";
import { BusinessSelectionPage } from "../pages/BusinessSelectionPage";
import { ItemsPage } from "../pages/ItemsPage";
import { AddItemPage } from "../pages/AddItemPage";
import { ItemDetailsPage } from "../pages/ItemDetailsPage";
import { OfflinePage } from "../pages/OfflinePage";
import { SessionHeader } from "../design-system/organisms/SessionHeader";
import { RequireAuth, RequireHydrated, RequireRole } from "./guards";

function AppEntryRoute() {
  const role = useSessionStore((state) => state.role);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);

  if (role === "PLATFORM_ADMIN") return <Navigate to="/app/businesses" replace />;
  if (role === "USER" && !isBusinessSelected) {
    return <Navigate to="/app/select-business" replace />;
  }
  return <AppHomePage />;
}

function AppLayout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);

  const isAuthenticated = Boolean(identityId);
  const isPlatformAdmin = role === "PLATFORM_ADMIN";

  return (
    <>
      {isAuthenticated ? (
        <div className="fixed inset-x-0 top-0 z-40 border-b border-white/60 bg-white/80 backdrop-blur-xl">
          <div className="px-2 py-2 sm:px-3 md:px-4">
            <SessionHeader
              showBack={!isPlatformAdmin && location.pathname !== "/app"}
              showSwitchStore={location.pathname !== "/app/select-business"}
              onLogout={onLogout}
            />
          </div>
        </div>
      ) : null}
      <div className={isAuthenticated ? "pt-14 sm:pt-16" : undefined}>
        <Outlet />
      </div>
    </>
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
            <Route path="/app" element={<AppEntryRoute />} />

            <Route element={<RequireRole role="USER" />}>
              <Route path="/app/select-business" element={<BusinessSelectionPage />} />
              <Route path="/app/items" element={<ItemsPage />} />
              <Route path="/app/items/new" element={<AddItemPage />} />
              <Route path="/app/items/:itemId" element={<ItemDetailsPage />} />
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
