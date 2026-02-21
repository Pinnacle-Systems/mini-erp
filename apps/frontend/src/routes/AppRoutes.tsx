import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useSessionStore } from "../features/auth/session-store";
import { useLogoutFlow } from "../features/auth/useLogoutFlow";
import { LoginPage } from "../pages/LoginPage";
import { AppHomePage } from "../pages/AppHomePage";
import { AdminHomePage } from "../pages/AdminHomePage";
import { AdminStoresPage } from "../pages/AdminStoresPage";
import { AdminStoreDetailsPage } from "../pages/AdminStoreDetailsPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { StoreSelectionPage } from "../pages/StoreSelectionPage";
import { OfflinePage } from "../pages/OfflinePage";
import { SessionHeader } from "../design-system/organisms/SessionHeader";
import { RequireAuth, RequireHydrated, RequireRole } from "./guards";

function AppEntryRoute() {
  const role = useSessionStore((state) => state.role);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);

  if (role === "PLATFORM_ADMIN") return <AdminHomePage />;
  if (role === "USER" && !isStoreSelected) {
    return <Navigate to="/app/select-store" replace />;
  }
  return <AppHomePage />;
}

function AppLayout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const identityId = useSessionStore((state) => state.identityId);

  const isAuthenticated = Boolean(identityId);

  return (
    <>
      {isAuthenticated ? (
        <div className="px-4 pt-4 sm:px-6 md:px-10">
          <SessionHeader
            showSwitchStore={location.pathname !== "/app/select-store"}
            onLogout={onLogout}
          />
        </div>
      ) : null}
      <Outlet />
    </>
  );
}

export function AppRoutes() {
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);
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
    !isOnline && (role === "PLATFORM_ADMIN" || !isAuthenticated);

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
              <Route path="/app/select-store" element={<StoreSelectionPage />} />
            </Route>

            <Route element={<RequireRole role="PLATFORM_ADMIN" />}>
              <Route path="/app/stores" element={<AdminStoresPage mode="list" />} />
              <Route path="/app/stores/new" element={<AdminStoresPage mode="new" />} />
              <Route path="/app/stores/:storeId" element={<AdminStoreDetailsPage />} />
              <Route path="/app/users" element={<AdminUsersPage />} />
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
