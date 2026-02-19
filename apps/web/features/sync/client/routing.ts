const SYNC_DISABLED_EXACT_PATHS = new Set([
  "/login",
  "/store-selection",
  "/manage-users",
  "/admin/stores/new",
]);

export const isSyncEnabledForPath = (pathname: string | null) => {
  if (!pathname) {
    return true;
  }

  return !SYNC_DISABLED_EXACT_PATHS.has(pathname);
};
