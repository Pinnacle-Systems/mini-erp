import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { Card } from "../molecules/Card";
import type { AssignedStore } from "../../features/auth/session-business";
import { cn } from "../../lib/utils";

type BusinessSelectionDialogProps = {
  title: string;
  businesses: AssignedStore[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelectBusiness: (businessId: string) => void;
  disabled?: boolean;
  error?: string | null;
  activeBusinessId?: string | null;
  activeLabel?: string;
  inactiveLabel?: string;
  overlayClassName?: string;
  panelOffsetClassName?: string;
  panelClassName?: string;
};

export function BusinessSelectionDialog({
  title,
  businesses,
  query,
  onQueryChange,
  onClose,
  onSelectBusiness,
  disabled = false,
  error = null,
  activeBusinessId = null,
  activeLabel = "Current business",
  inactiveLabel = "Tap to continue",
  overlayClassName,
  panelOffsetClassName = "mt-10 sm:mt-16",
  panelClassName,
}: BusinessSelectionDialogProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredBusinesses = normalizedQuery
    ? businesses.filter((business) =>
        business.name.toLowerCase().includes(normalizedQuery),
      )
    : businesses;

  const dialog = (
    <div
      className={cn("fixed inset-0 z-[80] bg-slate-950/40 p-3 sm:p-4", overlayClassName)}
    >
      <Card
        className={cn(
          "mx-auto w-full max-w-md rounded-xl p-3",
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

        <div>
          <Label htmlFor="business-selection-search" className="mb-1 block text-[11px]">
            Search business
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="business-selection-search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search business"
              autoComplete="off"
              className="h-9"
              style={{ paddingLeft: "2rem" }}
            />
          </div>
        </div>

        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

        <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {filteredBusinesses.map((business) => {
            const isActive = business.id === activeBusinessId;
            return (
              <button
                key={business.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectBusiness(business.id)}
                className={cn(
                  "w-full rounded-md border px-2 py-2 text-left transition",
                  isActive
                    ? "border-[#2f6fb7] bg-[#eaf3ff]"
                    : "border-border/70 bg-white hover:bg-muted/60",
                )}
              >
                <p className="truncate text-xs font-medium text-foreground">
                  {business.name}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {isActive ? activeLabel : inactiveLabel}
                </p>
              </button>
            );
          })}
          {filteredBusinesses.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">No businesses found.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}
