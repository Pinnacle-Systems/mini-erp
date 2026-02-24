import { ArrowLeft, Building2, LogOut } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../atoms/Button";
import { useSessionStore } from "../../features/auth/session-business";

type SessionHeaderProps = {
  onLogout: () => void;
  showSwitchStore?: boolean;
  showBack?: boolean;
  contextTitle?: string;
  contextSubtitle?: string;
};

export function SessionHeader({
  onLogout,
  showSwitchStore = true,
  showBack = false,
  contextTitle,
  contextSubtitle,
}: SessionHeaderProps) {
  const navigate = useNavigate();
  const role = useSessionStore((state) => state.role);
  const businesses = useSessionStore((state) => state.businesses);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const canSwitchStore = role === "USER" && businesses.length > 1 && showSwitchStore;
  const activeBusinessName = useMemo(
    () => businesses.find((business) => business.id === activeStore)?.name ?? "No business selected",
    [activeStore, businesses],
  );
  const showSelectedStore = role === "USER" && isBusinessSelected && showSwitchStore;
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app");
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-h-8">
        {contextTitle ? (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {contextTitle}
            </p>
            {contextSubtitle ? (
              <p className="text-[11px] leading-tight text-muted-foreground">
                {contextSubtitle}
              </p>
            ) : null}
          </div>
        ) : showSelectedStore ? (
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="cursor-pointer rounded-md px-1 py-0.5 text-left text-lg font-semibold tracking-[-0.01em] transition hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            title="Back to home"
          >
            {activeBusinessName}
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
            onClick={() => navigate("/app/select-business")}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Switch business
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
