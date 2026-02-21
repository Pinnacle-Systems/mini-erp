import { LogOut, Store } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../atoms/Button";
import { useSessionStore } from "../../features/auth/session-store";

type SessionHeaderProps = {
  onLogout: () => void;
  showSwitchStore?: boolean;
};

export function SessionHeader({
  onLogout,
  showSwitchStore = true,
}: SessionHeaderProps) {
  const navigate = useNavigate();
  const role = useSessionStore((state) => state.role);
  const stores = useSessionStore((state) => state.stores);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);
  const canSwitchStore = role === "USER" && stores.length > 1 && showSwitchStore;
  const activeStoreName = useMemo(
    () => stores.find((store) => store.id === activeStore)?.name ?? "No store selected",
    [activeStore, stores],
  );
  const showSelectedStore = role === "USER" && isStoreSelected && showSwitchStore;

  return (
    <section className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-h-8 text-lg font-semibold tracking-[-0.01em] text-foreground">
        {showSelectedStore ? activeStoreName : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canSwitchStore ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/app/select-store")}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Store className="h-4 w-4" aria-hidden="true" />
            Switch store
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={onLogout}
          className="h-8 gap-1.5 px-3 text-xs"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </Button>
      </div>
    </section>
  );
}
