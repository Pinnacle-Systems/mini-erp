import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./features/auth/SessionProvider";
import { SyncProvider } from "./features/sync/SyncProvider";
import { ToastProvider } from "./features/toast/ToastProvider";
import { AppRoutes } from "./routes/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <SyncProvider>
            <AppRoutes />
          </SyncProvider>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
