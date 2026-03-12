import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "../atoms/Button";
import { Label } from "../atoms/Label";
import { Select } from "../atoms/Select";
import { Card } from "../molecules/Card";
import { cn } from "../../lib/utils";

export type ActionReasonOption = {
  value: string;
  label: string;
};

type ActionReasonDialogProps = {
  title: string;
  description: string;
  reasonLabel?: string;
  reasons?: ActionReasonOption[];
  selectedReason?: string;
  confirmLabel: string;
  disabled?: boolean;
  hint?: string;
  overlayClassName?: string;
  panelOffsetClassName?: string;
  panelClassName?: string;
  onSelectedReasonChange?: (reason: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ActionReasonDialog({
  title,
  description,
  reasonLabel,
  reasons = [],
  selectedReason = "",
  confirmLabel,
  disabled = false,
  hint,
  overlayClassName,
  panelOffsetClassName = "mt-8 sm:mt-16",
  panelClassName,
  onSelectedReasonChange,
  onConfirm,
  onClose,
}: ActionReasonDialogProps) {
  const showsReasonPicker = reasons.length > 0 && reasonLabel && onSelectedReasonChange;
  const dialog = (
    <div
      className={cn("fixed inset-0 z-[90] bg-slate-950/40 p-3 sm:p-4", overlayClassName)}
    >
      <Card
        className={cn(
          "mx-auto w-full max-w-md rounded-lg border border-[#cfd9e5] bg-white p-0 shadow-[0_14px_40px_rgba(15,23,42,0.18)]",
          panelOffsetClassName,
          panelClassName,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#dbe4ee] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={disabled}
            className="h-7 w-7"
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="space-y-3 px-4 py-3">
          {showsReasonPicker ? (
            <div className="space-y-1">
              <Label htmlFor="action-reason-select">{reasonLabel}</Label>
              <Select
                id="action-reason-select"
                value={selectedReason}
                onChange={(event) => onSelectedReasonChange(event.target.value)}
                disabled={disabled}
                className="h-8 text-xs"
              >
                {reasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {hint ? (
            <div className="rounded-md border border-[#dbe4ee] bg-[#f8fbfe] px-3 py-2 text-[11px] text-muted-foreground">
              {hint}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#dbe4ee] px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={disabled}
            className="h-8 px-3 text-xs"
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className="h-8 px-3 text-xs"
          >
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}
