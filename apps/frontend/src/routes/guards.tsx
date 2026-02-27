import { Navigate, Outlet } from "react-router-dom";
import { useSessionStore } from "../features/auth/session-business";
import { SessionSplashPage } from "../pages/system";

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

export function RequireModule({
  moduleKey,
}: {
  moduleKey: "catalog" | "inventory" | "pricing";
}) {
  const modules = useSessionStore((state) => state.activeBusinessModules);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);

  if (!isBusinessSelected) {
    return <Navigate to="/app" replace />;
  }

  return modules?.[moduleKey] ? <Outlet /> : <Navigate to="/app" replace />;
}
