import type { CapacitorConfig } from "@capacitor/cli";

const appId = process.env.VITE_ANDROID_APP_ID?.trim() || "com.minierp.app";
const appName = process.env.VITE_ANDROID_APP_NAME?.trim() || "Mini ERP";

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
