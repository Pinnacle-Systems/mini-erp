import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Switch } from "../../design-system/atoms/Switch";
import { Card } from "../../design-system/molecules/Card";
import { cn } from "../../lib/utils";
import { formatCurrency } from "./useSalesDocumentWorkspace";

type PosPaymentModalProps = {
  total: number;
  posting: boolean;
  errorMessage?: string | null;
  autoPrintEnabled: boolean;
  onClose: () => void;
  onAutoPrintChange: (enabled: boolean) => void;
  onComplete: (amountTendered: number) => void;
};

const CASH_DENOMINATIONS = [20, 50, 100, 500];

function formatTenderedValue(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const [wholePart = "", decimalPart = ""] = normalized.split(".");
  return decimalPart.length > 0
    ? `${wholePart}.${decimalPart.slice(0, 2)}`
    : wholePart;
}

function getQuickTenderAmounts(total: number) {
  const roundedAmount = Math.ceil(total);
  const amounts = [
    total,
    ...(roundedAmount > total ? [roundedAmount] : []),
    ...CASH_DENOMINATIONS.filter((amount) => amount > total),
  ];

  return Array.from(
    new Set(
      amounts.filter((amount) => Number.isFinite(amount) && amount >= total),
    ),
  ).sort((left, right) => left - right);
}

export function PosPaymentModal({
  total,
  posting,
  errorMessage = null,
  autoPrintEnabled,
  onClose,
  onAutoPrintChange,
  onComplete,
}: PosPaymentModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [amountTenderedInput, setAmountTenderedInput] = useState(
    total > 0 ? total.toFixed(2) : "0.00",
  );

  const amountTendered = Number(amountTenderedInput);
  const changeDue =
    Number.isFinite(amountTendered) && amountTendered >= total
      ? amountTendered - total
      : 0;
  const canCompleteSale = Number.isFinite(amountTendered) && amountTendered >= total;
  const quickTenderAmounts = useMemo(() => getQuickTenderAmounts(total), [total]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!posting) {
          onClose();
        }
        return;
      }

      if (event.key === "Enter" && canCompleteSale && !posting) {
        event.preventDefault();
        onComplete(amountTendered);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [amountTendered, canCompleteSale, onClose, onComplete, posting]);

  const dialog = (
    <div className="fixed inset-0 z-[95] bg-slate-950/45 p-3 sm:p-4">
      <Card
        className={cn(
          "mx-auto mt-6 w-full max-w-lg rounded-xl border border-[#cfd9e5] bg-white p-0 shadow-[0_14px_40px_rgba(15,23,42,0.18)] sm:mt-14",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#dbe4ee] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Complete POS Sale</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cash-first checkout with tendered amount and change due.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={posting}
            className="h-8 w-8 shrink-0"
            aria-label="Close payment modal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="rounded-lg border border-[#8fb6e2] bg-[#edf5ff] px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#355a84]">
              Total Payable
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {formatCurrency(total)}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pos-payment-tendered">Cash tendered</Label>
            <Input
              ref={inputRef}
              id="pos-payment-tendered"
              value={amountTenderedInput}
              onChange={(event) =>
                setAmountTenderedInput(formatTenderedValue(event.target.value))
              }
              inputMode="decimal"
              className="h-10 text-sm"
              disabled={posting}
            />
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Quick Cash
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickTenderAmounts.map((amount) => {
                const isExactAmount = Math.abs(amount - total) < 0.001;
                return (
                  <Button
                    key={amount}
                    type="button"
                    variant={isExactAmount ? "default" : "outline"}
                    size="sm"
                    className="justify-center"
                    disabled={posting}
                    onClick={() => setAmountTenderedInput(amount.toFixed(2))}
                  >
                    {isExactAmount ? "Exact Amount" : formatCurrency(amount)}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/70 bg-slate-50 px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-[11px] font-semibold text-foreground">
                Auto-print receipt
              </div>
              <div className="text-[11px] text-muted-foreground">
                Remember this setting on this register.
              </div>
            </div>
            <Switch
              checked={autoPrintEnabled}
              onCheckedChange={onAutoPrintChange}
              disabled={posting}
              aria-label="Toggle auto-print receipt"
            />
          </div>

          <div className="grid gap-2 rounded-lg border border-border/70 bg-slate-50 p-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                Tendered
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {Number.isFinite(amountTendered)
                  ? formatCurrency(amountTendered)
                  : formatCurrency(0)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                Change Due
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {formatCurrency(changeDue)}
              </div>
            </div>
          </div>

          {!canCompleteSale ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              Cash tendered must cover the sale total before checkout can finish.
            </div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#dbe4ee] px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={posting}
            className="h-8 px-3 text-xs"
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={() => onComplete(amountTendered)}
            disabled={!canCompleteSale || posting}
            className="h-8 px-3 text-xs"
          >
            {posting ? "Completing..." : "Complete Sale"}
          </Button>
        </div>
      </Card>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}
