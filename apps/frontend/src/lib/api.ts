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

export type ApiContext = {
  activeStore: string | null;
  isBusinessSelected: boolean;
};

let getApiContext: (() => ApiContext) | null = null;

export const registerApiContext = (getter: () => ApiContext) => {
  getApiContext = getter;
};

const refreshAccessToken = async () => {
  const context = getApiContext?.() ?? { activeStore: null, isBusinessSelected: false };
  const { activeStore, isBusinessSelected } = context;
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

export class ConnectivityError extends Error {
  constructor(message = "Network connection lost or backend unreachable") {
    super(message);
    this.name = "ConnectivityError";
  }
}

export const apiFetch = async (
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {},
): Promise<Response> => {
  const { auth = true, retryOnUnauthorized = true } = options;

  // Fast-fail: suppressed obvious network work if browser definitely knows it's offline.
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ConnectivityError("Browser is offline");
  }

  const headers = new Headers(init.headers ?? {});

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (err) {
    // Intentional aborts (navigation, etc) should NOT be classified as connectivity errors
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    // Network failures (DNS, timeout, connection refused) are classified as connectivity errors
    throw new ConnectivityError();
  }

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

  try {
    return await fetch(apiUrl(path), {
      ...init,
      headers: retriedHeaders,
      credentials: "include",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new ConnectivityError();
  }
};
