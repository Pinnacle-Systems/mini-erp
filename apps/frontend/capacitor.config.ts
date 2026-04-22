import type { CapacitorConfig } from "@capacitor/cli";

const appId = process.env.VITE_ANDROID_APP_ID?.trim() || "com.pinnacle.billing";
const appName = process.env.VITE_ANDROID_APP_NAME?.trim() || "Pinnacle Billing";

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
