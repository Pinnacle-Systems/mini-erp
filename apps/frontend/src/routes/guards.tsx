import { Navigate, Outlet } from "react-router-dom";
import { useSessionStore } from "../features/auth/session-store";
import { SessionSplashPage } from "../pages/SessionSplashPage";

export function RequireHydrated() {
  const isHydratingSession = useSessionStore(
    (state) => state.isHydratingSession,
  );
  return isHydratingSession ? <SessionSplashPage /> : <Outlet />;
}

export function RequireAuth() {
  const identityId = useSessionStore((state) => state.identityId);
  return identityId ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireRole({ role }: { role: "USER" | "PLATFORM_ADMIN" }) {
  const currentRole = useSessionStore((state) => state.role);
  return currentRole === role ? <Outlet /> : <Navigate to="/app" replace />;
}
