import { ArrowLeft, Building2, ChevronDown, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../features/theme/useTheme";
import { Button } from "../atoms/Button";
import { BusinessSelectionDialog } from "./BusinessSelectionDialog";
import { LocationSelectionDialog } from "./LocationSelectionDialog";
import { cn } from "../../lib/utils";
import {
  hasAssignedStoreCapability,
  useSessionStore,
} from "../../features/auth/session-business";
import { selectLocation, selectStore } from "../../features/auth/client";
import { canSwitchStoreOffline } from "../../features/auth/license-policy";

type SessionHeaderProps = {
  showSwitchStore?: boolean;
  showBack?: boolean;
  contextTitle?: string;
  contextSubtitle?: string;
  onLogout?: (() => void) | undefined;
};

export function SessionHeader({
  showSwitchStore = true,
  showBack = false,
  contextTitle,
  contextSubtitle,
  onLogout,
}: SessionHeaderProps) {
  const navigate = useNavigate();
  const role = useSessionStore((state) => state.role);
  const identityId = useSessionStore((state) => state.identityId);
  const businesses = useSessionStore((state) => state.businesses);
  const activeStore = useSessionStore((state) => state.activeStore);
  const activeLocationId = useSessionStore((state) => state.activeLocationId);
  const activeMemberRole = useSessionStore((state) => state.activeMemberRole);
  const setActiveStore = useSessionStore((state) => state.setActiveStore);
  const setActiveLocation = useSessionStore((state) => state.setActiveLocation);
  const setActiveMemberRole = useSessionStore((state) => state.setActiveMemberRole);
  const setActiveBusinessModules = useSessionStore((state) => state.setActiveBusinessModules);
  const setStoreNeedsOnlineLicenseValidation = useSessionStore(
    (state) => state.setStoreNeedsOnlineLicenseValidation,
  );
  const setIsBusinessSelected = useSessionStore((state) => state.setIsBusinessSelected);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const { theme, availableThemes, setTheme } = useTheme();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isLocationSwitcherOpen, setIsLocationSwitcherOpen] = useState(false);
  const [switchQuery, setSwitchQuery] = useState("");
  const [locationSwitchQuery, setLocationSwitchQuery] = useState("");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const canSwitchStore = role === "USER" && businesses.length > 1 && showSwitchStore;
  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeStore) ?? null,
    [activeStore, businesses],
  );
  const activeBusinessName = useMemo(
    () => activeBusiness?.name ?? "No business selected",
    [activeBusiness],
  );
  const activeLocation = useMemo(
    () =>
      activeBusiness?.locations.find((location) => location.id === activeLocationId) ??
      activeBusiness?.locations.find((location) => location.isDefault) ??
      null,
    [activeBusiness, activeLocationId],
  );
  const activeLocationName = useMemo(
    () => activeLocation?.name ?? "Default location",
    [activeLocation],
  );
  const activeLocationOptionLabel = useMemo(
    () =>
      activeLocation
        ? `${activeLocation.name}${activeLocation.isDefault ? " (Default)" : ""}`
        : activeLocationName,
    [activeLocation, activeLocationName],
  );
  const formatLocationTriggerLabel = (name: string) =>
    name.replace(/\b\p{L}/gu, (character) => character.toUpperCase());
  const canSwitchLocation =
    role === "USER" &&
    activeMemberRole === "OWNER" &&
    Boolean(activeBusiness) &&
    hasAssignedStoreCapability(activeBusiness, "BUSINESS_LOCATIONS") &&
    (activeBusiness?.locations.length ?? 0) > 1;
  const showSelectedStore = role === "USER" && isBusinessSelected && showSwitchStore;
  const isDefaultLocationSelected = activeLocation?.isDefault ?? true;
  const isGroupedLocationControl = canSwitchStore;
  const standaloneLocationControl = canSwitchLocation && !isGroupedLocationControl;
  const showLocationSearch = (activeBusiness?.locations.length ?? 0) > 8;

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
      setActiveLocation(businessId, result.activeLocationId ?? null);
      setActiveMemberRole(result.memberRole ?? null);
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
        setActiveLocation(businessId, selectedBusiness?.defaultLocationId ?? null);
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

  const onSelectLocation = async (locationId: string) => {
    if (!activeStore || !activeBusiness || locationId === activeLocationId) {
      return;
    }

    setSwitching(true);
    setSwitchError(null);
    try {
      const result = await selectLocation(activeStore, locationId);
      setActiveLocation(activeStore, result.activeLocationId ?? locationId);
      setActiveMemberRole(result.memberRole ?? activeMemberRole);
      setActiveBusinessModules(result.modules ?? null);
      setIsLocationSwitcherOpen(false);
      setLocationSwitchQuery("");
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Unable to switch location.");
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
    <section className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-h-8 min-w-0 flex-1">
        {contextTitle ? (
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {contextTitle}
            </p>
            {contextSubtitle ? (
              <p className="hidden truncate text-[11px] leading-tight text-muted-foreground sm:block">
                {contextSubtitle}
              </p>
            ) : null}
          </div>
        ) : showSelectedStore ? (
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="max-w-full cursor-pointer truncate rounded-md px-1 py-0.5 text-left text-base font-semibold tracking-[-0.01em] transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-lg"
            title="Back to home"
          >
            {activeBusinessName}
          </button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="h-8 shrink-0 gap-1.5 px-2.5 text-xs lg:hidden md:px-3"
            aria-label="Go back"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Back</span>
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
            className="h-8 max-w-[3rem] shrink-0 gap-1.5 border-border/70 bg-muted/55 px-2 text-xs shadow-none hover:bg-muted/80 md:max-w-[13rem] md:px-2.5"
            aria-label="Switch business"
            title={activeBusinessName}
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:block truncate">{activeBusinessName}</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
        {canSwitchLocation ? (
          <button
            type="button"
            onClick={() => {
              setSwitchError(null);
              setLocationSwitchQuery("");
              setIsLocationSwitcherOpen(true);
            }}
            className={cn(
              "relative flex h-8 shrink-0 items-center overflow-hidden rounded-md transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-ring/65 focus-within:bg-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring/20",
              standaloneLocationControl
                ? "min-w-[11rem] max-w-[14rem] border border-input bg-muted/55 px-2.5 shadow-none"
                : "min-w-[9.75rem] max-w-[12rem] border border-border/70 bg-muted/55 px-2 shadow-none",
            )}
            disabled={switching}
            aria-label="Switch location"
            title={activeLocationOptionLabel}
          >
            <div
              className={cn(
                "pointer-events-none flex min-w-0 flex-1 items-center",
                standaloneLocationControl ? "gap-2" : "gap-1.5",
              )}
            >
              {standaloneLocationControl ? (
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                  Location
                </span>
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full transition-colors",
                  isDefaultLocationSelected ? "bg-transparent" : "bg-primary",
                )}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-xs",
                  isDefaultLocationSelected
                    ? standaloneLocationControl
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                    : "font-medium text-primary",
                )}
                title={activeLocationOptionLabel}
              >
                {formatLocationTriggerLabel(activeLocationName)}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </button>
        ) : showSelectedStore && activeBusiness ? (
          <div
            className="hidden shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-muted/55 px-2.5 py-1 text-[11px] text-muted-foreground md:flex"
            title={activeLocationOptionLabel}
          >
            <span className="text-[10px] font-medium text-muted-foreground">Location</span>
            <span className="max-w-[9rem] truncate text-foreground">
              {formatLocationTriggerLabel(activeLocationName)}
            </span>
          </div>
        ) : null}
        <label className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-muted/55 px-2 py-1 text-[11px] text-muted-foreground shadow-none">
          <span className="hidden sm:inline">Theme</span>
          <select
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value as typeof theme);
            }}
            className="min-w-[5.5rem] border-0 bg-transparent p-0 text-[11px] font-medium text-foreground outline-none"
            aria-label="Temporary theme switcher"
            title="Temporary theme switcher"
          >
            {availableThemes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {onLogout ? (
          <Button
            type="button"
            variant="outline"
            onClick={onLogout}
            className="h-8 w-8 shrink-0 p-0 text-xs md:w-auto md:gap-1.5 md:px-3"
            aria-label="Log out"
            title="Logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Logout</span>
          </Button>
        ) : null}
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
      {isLocationSwitcherOpen && activeBusiness ? (
        <LocationSelectionDialog
          title="Switch Location"
          locations={activeBusiness.locations}
          query={locationSwitchQuery}
          onQueryChange={setLocationSwitchQuery}
          onClose={() => setIsLocationSwitcherOpen(false)}
          onSelectLocation={(locationId) => {
            void onSelectLocation(locationId);
          }}
          disabled={switching}
          error={switchError}
          activeLocationId={activeLocation?.id ?? activeBusiness.defaultLocationId ?? null}
          inactiveLabel="Tap to switch"
          activeLabel="Current location"
          showSearch={showLocationSearch}
          panelOffsetClassName="mt-8 sm:mt-16"
          panelClassName="max-w-xs"
        />
      ) : null}
    </section>
  );
}
