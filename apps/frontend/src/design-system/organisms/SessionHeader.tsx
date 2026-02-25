import { ArrowLeft, Building2, ChevronDown, LogOut, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../atoms/Button";
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
  const filteredBusinesses = useMemo(() => {
    const query = switchQuery.trim().toLowerCase();
    if (!query) return businesses;
    return businesses.filter((business) => business.name.toLowerCase().includes(query));
  }, [businesses, switchQuery]);

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
        <div className="fixed inset-0 z-[80] bg-slate-950/40 p-3 sm:p-4">
          <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-white/70 bg-white p-3 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)] sm:mt-16">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Switch Business</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSwitcherOpen(false)}
                className="h-7 w-7 p-0"
                disabled={switching}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                value={switchQuery}
                onChange={(event) => setSwitchQuery(event.target.value)}
                placeholder="Search business"
                autoComplete="off"
                className="h-9 w-full rounded-md border border-[#c6d5e6] pl-8 pr-2 text-xs"
              />
            </div>
            {switchError ? <p className="mt-2 text-xs text-red-600">{switchError}</p> : null}
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {filteredBusinesses.map((business) => {
                const isActive = business.id === activeStore;
                return (
                  <button
                    key={business.id}
                    type="button"
                    disabled={switching}
                    onClick={() => void onSelectBusiness(business.id)}
                    className={`w-full rounded-lg border px-2 py-2 text-left transition ${
                      isActive
                        ? "border-[#2f6fb7] bg-[#eaf3ff]"
                        : "border-[#e1ebf6] bg-white hover:bg-[#f8fbff]"
                    }`}
                  >
                    <p className="truncate text-xs font-medium text-foreground">{business.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {isActive ? "Current business" : "Tap to switch"}
                    </p>
                  </button>
                );
              })}
              {filteredBusinesses.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">No businesses found.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
