import { Button } from "../../design-system/atoms/Button";
import {
  formatCurrency,
  normalizeLines,
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
  linesCountSource: Parameters<typeof normalizeLines>[0];
  sourceDocumentNumber?: string;
  validUntil: string;
  dispatchDate: string;
  dispatchReference: string;
  dispatchCarrier: string;
  isPosMode: boolean;
  isPosting?: boolean;
  canCheckout?: boolean;
  onOpenPosPayment?: () => void;
  desktopRailInset?: boolean;
  className?: string;
};

export function SalesDocumentSummaryPanel({
  config,
  activeBusinessName,
  totals,
  linesCountSource,
  sourceDocumentNumber,
  validUntil,
  dispatchDate,
  dispatchReference,
  dispatchCarrier,
  isPosMode,
  isPosting = false,
  canCheckout = true,
  onOpenPosPayment,
  desktopRailInset = true,
  className,
}: SalesDocumentSummaryPanelProps) {
  const normalizedLineCount = normalizeLines(linesCountSource).length;

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
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(totals.subTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Tax</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(totals.taxTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Lines</span>
          <span className="font-semibold text-foreground">
            {normalizedLineCount || 1}
          </span>
        </div>
        {sourceDocumentNumber ? (
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Source</span>
            <span className="truncate font-semibold text-foreground">
              {sourceDocumentNumber}
            </span>
          </div>
        ) : null}
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
        ) : (
          <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/55 px-2 py-1.5 text-xs">
            <span className="font-semibold text-foreground">Grand total</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(totals.grandTotal)}
            </span>
          </div>
        )}
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
