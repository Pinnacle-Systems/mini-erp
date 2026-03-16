import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { Card } from "../molecules/Card";
import { cn } from "../../lib/utils";

type LocationOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

type LocationSelectionDialogProps = {
  title: string;
  locations: LocationOption[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelectLocation: (locationId: string) => void;
  disabled?: boolean;
  error?: string | null;
  activeLocationId?: string | null;
  showSearch?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  panelOffsetClassName?: string;
  panelClassName?: string;
};

export function LocationSelectionDialog({
  title,
  locations,
  query,
  onQueryChange,
  onClose,
  onSelectLocation,
  disabled = false,
  error = null,
  activeLocationId = null,
  showSearch = false,
  activeLabel = "Current location",
  inactiveLabel = "Tap to switch",
  panelOffsetClassName = "mt-8 sm:mt-16",
  panelClassName,
}: LocationSelectionDialogProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLocations =
    showSearch && normalizedQuery
      ? locations.filter((location) =>
          location.name.toLowerCase().includes(normalizedQuery),
        )
      : locations;

  const dialog = (
    <div className="fixed inset-0 z-[80] bg-slate-950/40 p-3 sm:p-4">
      <Card
        className={cn(
          "mx-auto w-full max-w-[20rem] rounded-xl p-3",
          panelOffsetClassName,
          panelClassName,
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            className="h-7 w-7"
            disabled={disabled}
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {showSearch ? (
          <div>
            <Label htmlFor="location-selection-search" className="mb-1 block text-[11px]">
              Search location
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="location-selection-search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search location"
                autoComplete="off"
                className="h-9"
                style={{ paddingLeft: "2rem" }}
              />
            </div>
          </div>
        ) : null}

        {error ? <p className={cn("text-xs text-red-600", showSearch ? "mt-2" : "mb-2")}>{error}</p> : null}

        <div className={cn("space-y-1 overflow-y-auto", showSearch ? "mt-2 max-h-72" : "max-h-80")}>
          {filteredLocations.map((location) => {
            const isActive = location.id === activeLocationId;
            return (
              <button
                key={location.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectLocation(location.id)}
                className={cn(
                  "w-full rounded-md border px-2 py-2 text-left transition",
                  isActive
                    ? "border-[#2f6fb7] bg-[#eaf3ff]"
                    : "border-border/70 bg-white hover:bg-muted/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-medium text-foreground">
                    {location.name}
                  </p>
                  {location.isDefault ? (
                    <span className="shrink-0 rounded-full border border-[#2f6fb7] bg-[#edf4fb] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[#1f4167]">
                      Default
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {isActive ? activeLabel : inactiveLabel}
                </p>
              </button>
            );
          })}
          {filteredLocations.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">No locations found.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}
