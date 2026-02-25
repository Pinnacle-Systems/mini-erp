import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useSessionStore } from "../features/auth/session-business";
import { useLogoutFlow } from "../features/auth/useLogoutFlow";
import { LoginPage } from "../pages/auth";
import { AppHomePage } from "../pages/shell";
import { AdminLayout } from "../pages/admin/layout";
import { AdminBusinessesPage, AdminBusinessDetailsPage } from "../pages/admin/businesses";
import { AdminUsersPage, AdminUserDetailsPage } from "../pages/admin/users";
import { ItemsPage, AddItemPage, ItemDetailsPage } from "../pages/catalog/items";
import { OfflinePage } from "../pages/system";
import { SessionHeader } from "../design-system/organisms/SessionHeader";
import { RequireAuth, RequireHydrated, RequireRole } from "./guards";

function AppEntryRoute() {
  const role = useSessionStore((state) => state.role);

  if (role === "PLATFORM_ADMIN") return <Navigate to="/app/businesses" replace />;
  return <AppHomePage />;
}

function AppLayout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);

  const isAuthenticated = Boolean(identityId);
  const isPlatformAdmin = role === "PLATFORM_ADMIN";
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
        <div className="fixed inset-x-0 top-0 z-40 border-b border-white/60 bg-white/80 backdrop-blur-xl">
          <div className="px-2 py-2 sm:px-3 md:px-4">
            <SessionHeader
              showBack={!isPlatformAdmin && location.pathname !== "/app"}
              showSwitchStore
              contextTitle={headerContext?.title}
              contextSubtitle={headerContext?.subtitle}
              onLogout={onLogout}
            />
          </div>
        </div>
      ) : null}
      <div
        className={`overflow-visible overflow-x-hidden lg:h-full lg:overflow-y-auto ${isAuthenticated ? "pt-14 sm:pt-16" : ""}`}
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
