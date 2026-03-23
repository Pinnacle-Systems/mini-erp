/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ANDROID_API_BASE_URL?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_STORAGE_DIAGNOSTICS_MIN_QUOTA_MB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.jsx";
