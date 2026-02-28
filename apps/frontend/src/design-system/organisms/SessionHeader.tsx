import { ArrowLeft, Building2, ChevronDown, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../atoms/Button";
import { BusinessSelectionDialog } from "./BusinessSelectionDialog";
import { useSessionStore } from "../../features/auth/session-business";
import { selectStore } from "../../features/auth/client";
import { canSwitchStoreOffline } from "../../features/auth/license-policy";

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
  const identityId = useSessionStore((state) => state.identityId);
  const businesses = useSessionStore((state) => state.businesses);
  const activeStore = useSessionStore((state) => state.activeStore);
  const setActiveStore = useSessionStore((state) => state.setActiveStore);
  const setActiveBusinessModules = useSessionStore((state) => state.setActiveBusinessModules);
  const setStoreNeedsOnlineLicenseValidation = useSessionStore(
    (state) => state.setStoreNeedsOnlineLicenseValidation,
  );
  const setIsBusinessSelected = useSessionStore((state) => state.setIsBusinessSelected);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [switchQuery, setSwitchQuery] = useState("");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const canSwitchStore = role === "USER" && businesses.length > 1 && showSwitchStore;
  const activeBusinessName = useMemo(
    () => businesses.find((business) => business.id === activeStore)?.name ?? "No business selected",
    [activeStore, businesses],
  );
  const showSelectedStore = role === "USER" && isBusinessSelected && showSwitchStore;

  const onSelectBusiness = async (businessId: string) => {
    if (businessId === activeStore) {
      setIsSwitcherOpen(false);
      return;
    }
    setSwitching(true);
    setSwitchError(null);
    try {
      const result = await selectStore(businessId);
      setActiveStore(businessId);
      setActiveBusinessModules(result.modules ?? null);
      setStoreNeedsOnlineLicenseValidation(businessId, false);
      setIsBusinessSelected(true);
      setIsSwitcherOpen(false);
      setSwitchQuery("");
      navigate("/app", { replace: true });
    } catch (error) {
      const isNetworkFailure = !navigator.onLine || error instanceof TypeError;
      if (identityId && isNetworkFailure) {
        const selectedBusiness = businesses.find((business) => business.id === businessId);
        const offlinePolicy = canSwitchStoreOffline(selectedBusiness);
        if (!offlinePolicy.allowed) {
          setSwitchError(offlinePolicy.reason ?? "Business cannot be selected offline.");
          setSwitching(false);
          return;
        }
        setActiveStore(businessId);
        setStoreNeedsOnlineLicenseValidation(businessId, true);
        setIsBusinessSelected(true);
        setIsSwitcherOpen(false);
        setSwitchQuery("");
        navigate("/app", { replace: true });
        setSwitching(false);
        return;
      }
      setSwitchError(error instanceof Error ? error.message : "Unable to switch business.");
    } finally {
      setSwitching(false);
    }
  };

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
            onClick={() => {
              setSwitchError(null);
              setSwitchQuery("");
              setIsSwitcherOpen(true);
            }}
            className="h-8 max-w-[13rem] gap-1.5 px-2.5 text-xs"
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{activeBusinessName}</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
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
      {isSwitcherOpen ? (
        <BusinessSelectionDialog
          title="Switch Business"
          businesses={businesses}
          query={switchQuery}
          onQueryChange={setSwitchQuery}
          onClose={() => setIsSwitcherOpen(false)}
          onSelectBusiness={(businessId) => {
            void onSelectBusiness(businessId);
          }}
          disabled={switching}
          error={switchError}
          activeBusinessId={activeStore}
          inactiveLabel="Tap to switch"
          panelOffsetClassName="mt-8 sm:mt-16"
        />
      ) : null}
    </section>
  );
}
