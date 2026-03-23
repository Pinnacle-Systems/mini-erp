import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";

type Cleanup = () => void;

type BackButtonListener = (event: { canGoBack: boolean }) => void;
type AppStateListener = (event: { isActive: boolean }) => void;
type NetworkListener = (event: { connected: boolean }) => void;

const toCleanup = (remove: Promise<{ remove: () => Promise<void> }>): Cleanup => {
  let active = true;

  void remove.then((handle) => {
    if (!active) {
      void handle.remove();
    }
  });

  return () => {
    active = false;
    void remove.then((handle) => handle.remove());
  };
};

export const isNativeApp = () => Capacitor.isNativePlatform();

export const isNativeAndroidApp = () =>
  isNativeApp() && Capacitor.getPlatform() === "android";

export const addBackButtonListener = (listener: BackButtonListener): Cleanup => {
  if (!isNativeAndroidApp()) {
    return () => {};
  }

  return toCleanup(
    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      listener({ canGoBack });
    }),
  );
};

export const addAppStateListener = (listener: AppStateListener): Cleanup => {
  if (!isNativeApp()) {
    return () => {};
  }

  return toCleanup(
    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      listener({ isActive });
    }),
  );
};

export const addNetworkListener = (listener: NetworkListener): Cleanup => {
  if (isNativeApp()) {
    return toCleanup(
      Network.addListener("networkStatusChange", ({ connected }) => {
        listener({ connected });
      }),
    );
  }

  const onOnline = () => listener({ connected: true });
  const onOffline = () => listener({ connected: false });
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
};

export const exitNativeApp = () => {
  if (!isNativeAndroidApp()) {
    return;
  }

  CapacitorApp.exitApp();
};
