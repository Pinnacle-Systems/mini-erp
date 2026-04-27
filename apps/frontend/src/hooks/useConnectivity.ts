import { useCallback, useEffect, useState } from "react";
import { ConnectivityError } from "../lib/api";

export const isConnectivityError = (error: unknown) => {
  if (error instanceof ConnectivityError) {
    return true;
  }

  return error instanceof Error && error.name === "ConnectivityError";
};

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const classifyError = useCallback(
    (error: unknown) => ({
      isConnectivityError: isConnectivityError(error),
    }),
    [],
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    classifyError,
  };
}
