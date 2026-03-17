import { Button } from "../../design-system/atoms/Button";
import {
  formatCurrency,
  normalizeLines,
  type InvoiceListRow,
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
  validUntil: string;
  dispatchDate: string;
  dispatchReference: string;
  dispatchCarrier: string;
  isPosMode: boolean;
  isPosting?: boolean;
  invoiceRows: InvoiceListRow[];
  onOpenInvoiceRow: (row: InvoiceListRow) => void;
  onOpenList: () => void;
  onOpenPosPayment?: () => void;
};

export function SalesDocumentSummaryPanel({
  config,
  activeBusinessName,
  totals,
  linesCountSource,
  validUntil,
  dispatchDate,
  dispatchReference,
  dispatchCarrier,
  isPosMode,
  isPosting = false,
  invoiceRows,
  onOpenInvoiceRow,
  onOpenList,
  onOpenPosPayment,
}: SalesDocumentSummaryPanelProps) {
  return (
    <div className="w-full border-t border-border/70 pt-2 md:w-[320px] md:border-l md:border-t-0 md:pl-4 md:pt-0">
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
            {normalizeLines(linesCountSource).length || 1}
          </span>
        </div>
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
        <div className="flex items-center justify-between rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-xs">
          <span className="font-semibold text-foreground">Grand total</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(totals.grandTotal)}
          </span>
        </div>
        {isPosMode ? (
          <div className="space-y-2 border-t border-border/70 pt-2">
            {onOpenPosPayment ? (
              <Button
                type="button"
                size="sm"
                className="w-full justify-between"
                onClick={onOpenPosPayment}
                disabled={isPosting}
              >
                <span>{isPosting ? "Working..." : "Pay Now"}</span>
                <span className="rounded border border-white/40 bg-white/10 px-1 py-0 text-[10px] font-medium text-white/90">
                  Ctrl+Enter
                </span>
              </Button>
            ) : null}
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground">Recent sales</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[#1f4167] hover:underline"
                onClick={onOpenList}
              >
                Open list
              </Button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {invoiceRows.slice(0, 5).map((row) => (
                <Button
                  key={`${row.source}:${row.id}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex h-auto w-full items-center justify-between rounded-md border-border/70 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-normal hover:border-[#8fb6e2] hover:bg-[#edf5ff]"
                  onClick={() => onOpenInvoiceRow(row)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {row.billNumber}
                    </span>
                    <span className="block truncate text-muted-foreground">
                      {row.customerName}
                    </span>
                  </span>
                  <span className="shrink-0 pl-2 font-semibold text-foreground">
                    {formatCurrency(row.total)}
                  </span>
                </Button>
              ))}
              {invoiceRows.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 px-2 py-2 text-[11px] text-muted-foreground">
                  No POS sales yet.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
