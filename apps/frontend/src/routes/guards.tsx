import { Navigate, Outlet } from "react-router-dom";
import {
  useSessionStore,
  hasAssignedStoreCapability,
  type BusinessCapability,
} from "../features/auth/session-business";
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
  moduleKey: "catalog" | "inventory" | "purchases" | "pricing" | "sales";
}) {
  const modules = useSessionStore((state) => state.activeBusinessModules);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);

  if (!isBusinessSelected) {
    return <Navigate to="/app" replace />;
  }

  return modules?.[moduleKey] ? <Outlet /> : <Navigate to="/app" replace />;
}

export function RequireCapability({
  capability,
}: {
  capability: BusinessCapability;
}) {
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);

  if (!isBusinessSelected) {
    return <Navigate to="/app" replace />;
  }

  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;

  return hasAssignedStoreCapability(activeBusiness, capability) ? (
    <Outlet />
  ) : (
    <Navigate to="/app" replace />
  );
}

export function RequireAnyCapability({
  capabilities,
}: {
  capabilities: BusinessCapability[];
}) {
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);

  if (!isBusinessSelected) {
    return <Navigate to="/app" replace />;
  }

  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;

  return capabilities.some((capability) =>
    hasAssignedStoreCapability(activeBusiness, capability),
  ) ? (
    <Outlet />
  ) : (
    <Navigate to="/app" replace />
  );
}
