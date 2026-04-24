import { isNativeAndroidApp } from "../platform/capacitor";
import { AppHttp } from "../plugins/app-http";

const ACCESS_TOKEN_KEY = "mini_erp_frontend_access_token";

type NativeTransportErrorType =
  | "offline"
  | "dns_failure"
  | "timeout"
  | "connection_failure"
  | "tls_failure"
  | "cancelled";

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

const getAndroidDnsHost = () => {
  if (!isNativeAndroidApp()) {
    return null;
  }

  const androidBaseUrl = normalizeBaseUrl(import.meta.env.VITE_ANDROID_API_BASE_URL);
  if (!androidBaseUrl) {
    return null;
  }

  try {
    return new URL(androidBaseUrl).hostname;
  } catch {
    return null;
  }
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

const headersToObject = (headers: Headers) => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const bodyToText = async (body: RequestInit["body"]) => {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (!body) return undefined;
  if (body instanceof Blob) {
    return await body.text();
  }

  throw new Error("Unsupported request body for native Android transport");
};

const nativeFetch = async (path: string, init: RequestInit, headers: Headers) => {
  const bodyText = await bodyToText(init.body);
  const payload = await AppHttp.execute({
    url: apiUrl(path),
    method: init.method ?? "GET",
    headers: headersToObject(headers),
    ...(bodyText !== undefined ? { bodyText } : {}),
    ...(getAndroidDnsHost() ? { dnsHost: getAndroidDnsHost() ?? undefined } : {}),
  });

  return new Response(payload.bodyText, {
    status: payload.status,
    headers: payload.headers,
  });
};

const fetchWithTransport = async (
  path: string,
  init: RequestInit,
  headers: Headers,
) => {
  if (isNativeAndroidApp()) {
    return nativeFetch(path, init, headers);
  }

  return fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });
};

const refreshAccessToken = async () => {
  const context = getApiContext?.() ?? { activeStore: null, isBusinessSelected: false };
  const { activeStore, isBusinessSelected } = context;
  const currentBusinessId = isBusinessSelected ? activeStore : null;
  const response = await fetchWithTransport("/api/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      currentBusinessId ? { currentBusinessId } : {},
    ),
  }, new Headers({
    "Content-Type": "application/json",
  }));

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
  readonly errorType?: NativeTransportErrorType;

  constructor(
    message = "Network connection lost or backend unreachable",
    errorType?: NativeTransportErrorType,
  ) {
    super(message);
    this.name = "ConnectivityError";
    this.errorType = errorType;
  }
}

const isNativeTransportErrorType = (value: unknown): value is NativeTransportErrorType =>
  value === "offline" ||
  value === "dns_failure" ||
  value === "timeout" ||
  value === "connection_failure" ||
  value === "tls_failure" ||
  value === "cancelled";

const toConnectivityError = (err: unknown) => {
  if (err instanceof ConnectivityError) {
    return err;
  }

  const errorTypeCandidate =
    typeof err === "object" && err !== null
      ? ("code" in err && typeof err.code === "string"
          ? err.code
          : "data" in err &&
              typeof err.data === "object" &&
              err.data !== null &&
              "errorType" in err.data &&
              typeof err.data.errorType === "string"
            ? err.data.errorType
            : undefined)
      : undefined;

  const errorType = isNativeTransportErrorType(errorTypeCandidate)
    ? errorTypeCandidate
    : undefined;

  const message =
    errorType === "dns_failure"
      ? "Backend hostname could not be resolved"
      : errorType === "timeout"
        ? "Backend request timed out"
        : errorType === "tls_failure"
          ? "Secure connection to backend failed"
          : errorType === "offline"
            ? "Browser is offline"
            : errorType === "cancelled"
              ? "Network request was cancelled"
              : "Network connection lost or backend unreachable";

  return new ConnectivityError(message, errorType);
};

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
    response = await fetchWithTransport(path, init, headers);
  } catch (err) {
    // Intentional aborts (navigation, etc) should NOT be classified as connectivity errors
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    if (err instanceof Error && /Unsupported request body/i.test(err.message)) {
      throw err;
    }
    // Network failures (DNS, timeout, connection refused) are classified as connectivity errors
    throw toConnectivityError(err);
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
    return await fetchWithTransport(path, init, retriedHeaders);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    if (err instanceof Error && /Unsupported request body/i.test(err.message)) {
      throw err;
    }
    throw toConnectivityError(err);
  }
};
