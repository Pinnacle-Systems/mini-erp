import { createPortal } from "react-dom";
import { Clock3, X } from "lucide-react";
import { Button } from "../atoms/Button";
import { Card } from "../molecules/Card";
import { cn } from "../../lib/utils";
import type { SalesDocumentHistoryEntry } from "../../pages/sales/sales-documents-api";
import type { PurchaseDocumentHistoryEntry } from "../../pages/purchases/purchase-documents-api";

type DocumentHistoryEntry = SalesDocumentHistoryEntry | PurchaseDocumentHistoryEntry;

type DocumentHistoryDialogProps = {
  title: string;
  description: string;
  entries: DocumentHistoryEntry[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const PURCHASE_DOCUMENT_TYPE_LABELS = {
  PURCHASE_ORDER: "purchase order",
  GOODS_RECEIPT_NOTE: "goods receipt",
  PURCHASE_INVOICE: "purchase invoice",
  PURCHASE_RETURN: "purchase return",
} as const;

const SALES_DOCUMENT_TYPE_LABELS = {
  SALES_ESTIMATE: "estimate",
  SALES_ORDER: "sales order",
  DELIVERY_CHALLAN: "delivery challan",
  SALES_INVOICE: "invoice",
  SALES_RETURN: "sales return",
} as const;

const toSentenceCase = (value: string) =>
  value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

const formatDocumentTypeLabel = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  if (value in PURCHASE_DOCUMENT_TYPE_LABELS) {
    return PURCHASE_DOCUMENT_TYPE_LABELS[value as keyof typeof PURCHASE_DOCUMENT_TYPE_LABELS];
  }

  if (value in SALES_DOCUMENT_TYPE_LABELS) {
    return SALES_DOCUMENT_TYPE_LABELS[value as keyof typeof SALES_DOCUMENT_TYPE_LABELS];
  }

  return null;
};

const getConversionDocumentContext = (entry: DocumentHistoryEntry) => {
  const sourceDocumentType = formatDocumentTypeLabel(entry.metadata?.sourceDocumentType);
  const sourceDocumentNumber =
    typeof entry.metadata?.sourceDocumentNumber === "string"
      ? entry.metadata.sourceDocumentNumber
      : null;
  const targetDocumentType = formatDocumentTypeLabel(entry.metadata?.targetDocumentType);
  const targetDocumentNumber =
    typeof entry.metadata?.targetDocumentNumber === "string"
      ? entry.metadata.targetDocumentNumber
      : null;

  return {
    sourceDocumentType,
    sourceDocumentNumber,
    targetDocumentType,
    targetDocumentNumber,
  };
};

const formatEventTitle = (entry: DocumentHistoryEntry) => {
  if (entry.eventType === "CREATED") {
    return "Draft created";
  }
  if (entry.eventType === "UPDATED") {
    return "Draft updated";
  }
  if (entry.eventType === "CONVERSION_LINKED") {
    const direction = entry.metadata?.direction;
    const {
      sourceDocumentType,
      sourceDocumentNumber,
      targetDocumentType,
      targetDocumentNumber,
    } = getConversionDocumentContext(entry);

    if (direction === "FROM_SOURCE") {
      if (sourceDocumentType && sourceDocumentNumber) {
        return `Created from ${sourceDocumentType} ${sourceDocumentNumber}`;
      }
      return "Created from source document";
    }
    if (direction === "TO_TARGET") {
      if (targetDocumentType && targetDocumentNumber) {
        return `Converted to ${targetDocumentType} ${targetDocumentNumber}`;
      }
      return "Converted to target document";
    }
    return "Conversion linked";
  }

  if (entry.fromStatus && entry.toStatus) {
    return `Status changed: ${entry.fromStatus} -> ${entry.toStatus}`;
  }

  return "Status changed";
};

const formatEventDetails = (entry: DocumentHistoryEntry) => {
  if (entry.eventType === "CONVERSION_LINKED") {
    const direction = entry.metadata?.direction;
    const {
      sourceDocumentType,
      sourceDocumentNumber,
      targetDocumentType,
      targetDocumentNumber,
    } = getConversionDocumentContext(entry);

    if (direction === "FROM_SOURCE" && sourceDocumentType && sourceDocumentNumber) {
      return `Created from ${toSentenceCase(sourceDocumentType)} ${sourceDocumentNumber}.`;
    }
    if (direction === "TO_TARGET" && targetDocumentType && targetDocumentNumber) {
      return `Target document: ${toSentenceCase(targetDocumentType)} ${targetDocumentNumber}.`;
    }
  }

  if (typeof entry.metadata?.cancelReason === "string") {
    return `Reason: ${entry.metadata.cancelReason.replaceAll("_", " ").toLowerCase()}`;
  }

  if (typeof entry.metadata?.reason === "string") {
    return `Reason: ${entry.metadata.reason.replaceAll("_", " ").toLowerCase()}`;
  }

  return null;
};

export function DocumentHistoryDialog({
  title,
  description,
  entries,
  loading = false,
  error = null,
  onClose,
}: DocumentHistoryDialogProps) {
  const dialog = (
    <div className="fixed inset-0 z-[90] bg-slate-950/45 p-0 md:p-4">
      <Card
        className={cn(
          "h-full w-full rounded-none border-0 bg-card p-0 shadow-none",
          "md:mx-auto md:mt-8 md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-xl md:border md:border-border/80 md:shadow-[0_14px_40px_rgba(15,23,42,0.18)]",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/80 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 shrink-0"
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 overflow-y-auto px-4 py-3 md:max-h-[calc(85vh-7.5rem)]">
          {loading ? (
            <div className="rounded-md border border-border/70 bg-muted/55 px-3 py-3 text-xs text-muted-foreground">
              Loading document history...
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-3 text-xs text-destructive">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-md border border-border/70 bg-muted/55 px-3 py-3 text-xs text-muted-foreground">
              No history has been recorded for this document yet.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const details = formatEventDetails(entry);
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {formatEventTitle(entry)}
                        </p>
                        {details ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {details}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {entry.actorName?.trim() || "Unknown user"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{formatTimestamp(entry.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border/80 px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} className="h-8 px-3 text-xs">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}
