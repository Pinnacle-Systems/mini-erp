"use client";

export const AUTH_CACHE_KEY = "mini_erp_auth_state_v1";

export type AuthCacheState = {
  isAuthenticated: boolean;
  checkedAt: number;
};

export const readAuthCache = (): AuthCacheState | null => {
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AuthCacheState;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.isAuthenticated !== "boolean" ||
      typeof parsed.checkedAt !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const writeAuthCache = (isAuthenticated: boolean) => {
  const payload: AuthCacheState = {
    isAuthenticated,
    checkedAt: Date.now(),
  };
  window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
};
