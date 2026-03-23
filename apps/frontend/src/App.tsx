import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./features/auth/SessionProvider";
import { SyncProvider } from "./features/sync/SyncProvider";
import { ThemeProvider } from "./features/theme/ThemeProvider";
import { ToastProvider } from "./features/toast/ToastProvider";
import { MobilePlatformBridge } from "./platform/MobilePlatformBridge";
import { AppRoutes } from "./routes/AppRoutes";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <SessionProvider>
            <SyncProvider>
              <MobilePlatformBridge>
                <AppRoutes />
              </MobilePlatformBridge>
            </SyncProvider>
          </SessionProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
