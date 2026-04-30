import { Info } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import type { FinancialDocumentBalanceRow } from "../finance/financial-api";
import {
  formatCurrency,
  type SalesDocumentPageConfig,
} from "./useSalesDocumentWorkspace";

type SalesDocumentSummaryPanelProps = {
  config: SalesDocumentPageConfig;
  activeBusinessName: string;
  totals: {
    subTotal: number;
    taxTotal: number;
    grandTotal: number;
  };
  validUntil: string;
  dispatchDate: string;
  dispatchReference: string;
  dispatchCarrier: string;
  isPosMode: boolean;
  isPosting?: boolean;
  canCheckout?: boolean;
  onOpenPosPayment?: () => void;
  financialBalance?: FinancialDocumentBalanceRow | null;
  desktopRailInset?: boolean;
  className?: string;
};

export function SalesDocumentSummaryPanel({
  config,
  activeBusinessName,
  totals,
  validUntil,
  dispatchDate,
  dispatchReference,
  dispatchCarrier,
  isPosMode,
  isPosting = false,
  canCheckout = true,
  onOpenPosPayment,
  financialBalance = null,
  desktopRailInset = true,
  className,
}: SalesDocumentSummaryPanelProps) {
  return (
    <div
      className={`w-full border-t border-border/70 pt-2 md:w-[280px] md:border-t-0 md:pt-0 ${
        desktopRailInset ? "md:border-l md:pl-4" : ""
      } ${
        isPosMode ? "md:self-stretch" : ""
      } ${className ?? ""}`}
    >
      <div
        className={`rounded-xl border px-3 py-3 ${
          isPosMode
            ? "border-border/80 bg-muted/55"
            : "border-transparent bg-transparent px-0 py-0"
        }`}
      >
      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap border-b border-border/70 pb-2 text-[11px]">
        <span className="shrink-0 font-semibold text-foreground">
          {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} Summary`}
        </span>
        <span className="shrink-0 text-muted-foreground">•</span>
        <span className="truncate text-muted-foreground">{activeBusinessName}</span>
      </div>
      <div className="space-y-2 pt-2">
        <div className="space-y-1.5 px-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[11px] leading-tight">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(totals.subTotal)}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[11px] leading-tight">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(totals.taxTotal)}
            </span>
          </div>
        </div>
        {financialBalance ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/70 bg-muted/55 px-2 py-1.5 text-xs">
              <span className="font-semibold text-foreground">Grand total</span>
              <span className="text-sm font-extrabold text-foreground">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2 text-xs leading-tight">
              <div className="flex min-w-0 items-center gap-1">
                <span
                  className={
                    financialBalance.netOutstandingAmount < 0
                      ? "truncate font-semibold text-fuchsia-700"
                      : "truncate text-muted-foreground"
                  }
                >
                  {financialBalance.netOutstandingAmount < 0
                    ? "Customer credit"
                    : "Outstanding"}
                </span>
                {financialBalance.netOutstandingAmount < 0 ? (
                  <span
                    className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-fuchsia-200/80 bg-fuchsia-50/80 text-fuchsia-700/85"
                    title="Receipts and returns exceed the invoice total. A customer credit or refund is due."
                    aria-label="Customer credit explanation"
                  >
                    <Info className="h-2 w-2" aria-hidden="true" />
                  </span>
                ) : null}
              </div>
              <span
                className={
                  financialBalance.netOutstandingAmount < 0
                    ? "font-semibold text-fuchsia-700"
                    : "font-semibold text-foreground"
                }
              >
                {formatCurrency(Math.abs(financialBalance.netOutstandingAmount))}
              </span>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/70 bg-muted/55 px-2 py-1.5 text-xs">
            <span className="font-semibold text-foreground">Grand total</span>
            <span className="text-sm font-extrabold text-foreground">
              {formatCurrency(totals.grandTotal)}
            </span>
          </div>
        )}
        {config.documentType === "SALES_ESTIMATE" && validUntil ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Valid until</span>
            <span className="font-semibold text-foreground">{validUntil}</span>
          </div>
        ) : null}
        {config.documentType === "DELIVERY_CHALLAN" ? (
          <>
            {dispatchDate ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Dispatch date</span>
                <span className="font-semibold text-foreground">{dispatchDate}</span>
              </div>
            ) : null}
            {dispatchReference ? (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Reference</span>
                <span className="truncate font-semibold text-foreground">
                  {dispatchReference}
                </span>
              </div>
            ) : null}
            {dispatchCarrier ? (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Carrier</span>
                <span className="truncate font-semibold text-foreground">
                  {dispatchCarrier}
                </span>
              </div>
            ) : null}
          </>
        ) : null}
        {isPosMode ? (
          <div className="rounded-lg border border-primary/25 bg-primary/6 px-3 py-3 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
              Total payable
            </div>
            <div className="mt-1 text-4xl font-semibold tracking-[-0.03em] text-foreground">
              {formatCurrency(totals.grandTotal)}
            </div>
          </div>
        ) : null}
        {isPosMode ? (
          <div className="border-t border-border/70 pt-2">
            {onOpenPosPayment ? (
              <Button
                type="button"
                size="sm"
                className="group w-full justify-between disabled:border-input disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100"
                onClick={onOpenPosPayment}
                disabled={isPosting || !canCheckout}
              >
                <span>
                  {isPosting ? "Working..." : canCheckout ? "Pay Now" : "Add item to pay"}
                </span>
                <span className="rounded border border-primary-foreground/25 bg-primary-foreground/10 px-1 py-0 text-[10px] font-medium text-primary-foreground/90 group-disabled:border-border/70 group-disabled:bg-muted/70 group-disabled:text-muted-foreground">
                  Ctrl+Enter
                </span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
