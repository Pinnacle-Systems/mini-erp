import { ArrowLeft, LogOut, Store } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../atoms/Button";
import { useSessionStore } from "../../features/auth/session-store";

type SessionHeaderProps = {
  onLogout: () => void;
  showSwitchStore?: boolean;
  showBack?: boolean;
};

export function SessionHeader({
  onLogout,
  showSwitchStore = true,
  showBack = false,
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
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app");
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-h-8 text-lg font-semibold tracking-[-0.01em] text-foreground">
        {showSelectedStore ? (
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="cursor-pointer rounded-md px-1 py-0.5 text-left transition hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            title="Back to home"
          >
            {activeStoreName}
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
        ) : null}
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
