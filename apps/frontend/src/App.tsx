import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./features/auth/SessionProvider";
import { SyncProvider } from "./features/sync/SyncProvider";
import { AppRoutes } from "./routes/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <SyncProvider>
          <AppRoutes />
        </SyncProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}

export default App;
