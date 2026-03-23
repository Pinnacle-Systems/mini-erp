import { useSessionStore } from "../features/auth/session-business";
import { isNativeAndroidApp } from "../platform/capacitor";

const ACCESS_TOKEN_KEY = "mini_erp_frontend_access_token";

const normalizeBaseUrl = (value: string | undefined) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

const getApiBaseUrl = () => {
  if (isNativeAndroidApp()) {
    const androidBaseUrl = normalizeBaseUrl(import.meta.env.VITE_ANDROID_API_BASE_URL);
    if (androidBaseUrl) {
      return androidBaseUrl;
    }
  }

  const explicitBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  if (import.meta.env.DEV) {
    return normalizeBaseUrl(import.meta.env.VITE_DEV_PROXY_TARGET);
  }

  return "";
};

export const getAccessToken = () => window.localStorage.getItem(ACCESS_TOKEN_KEY);

export const setAccessToken = (token: string | null) => {
  if (!token) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

export const apiUrl = (path: string) => `${getApiBaseUrl()}${path}`;

export const apiAssetUrl = (path: string | null | undefined) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return apiUrl(normalized);
};

type ApiFetchOptions = {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

const refreshAccessToken = async () => {
  const { activeStore, isBusinessSelected } = useSessionStore.getState();
  const currentBusinessId = isBusinessSelected ? activeStore : null;
  const response = await fetch(apiUrl("/api/auth/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      currentBusinessId ? { currentBusinessId } : {},
    ),
    credentials: "include"
  });

  if (!response.ok) {
    setAccessToken(null);
    return false;
  }

  const payload = (await response.json()) as { token?: string };
  if (payload.token) {
    setAccessToken(payload.token);
    return true;
  }

  return false;
};

export const apiFetch = async (
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<Response> => {
  const { auth = true, retryOnUnauthorized = true } = options;
  const headers = new Headers(init.headers ?? {});

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include"
  });

  if (!auth || !retryOnUnauthorized || response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return response;
  }

  const retriedHeaders = new Headers(init.headers ?? {});
  const refreshedToken = getAccessToken();
  if (refreshedToken) {
    retriedHeaders.set("Authorization", `Bearer ${refreshedToken}`);
  }

  return fetch(apiUrl(path), {
    ...init,
    headers: retriedHeaders,
    credentials: "include"
  });
};
