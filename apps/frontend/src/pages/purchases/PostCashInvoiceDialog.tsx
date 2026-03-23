import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import { Card } from "../../design-system/molecules/Card";
import { cn } from "../../lib/utils";
import type { FinancialAccountRow } from "../finance/financial-api";

type PostCashInvoiceDialogProps = {
  open: boolean;
  totalLabel: string;
  documentLabel: string;
  accountOptions: FinancialAccountRow[];
  selectedAccountId: string;
  paymentReference: string;
  paymentDate: string;
  loading?: boolean;
  error?: string | null;
  onSelectedAccountIdChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onPaymentDateChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function PostCashInvoiceDialog({
  open,
  totalLabel,
  documentLabel,
  accountOptions,
  selectedAccountId,
  paymentReference,
  paymentDate,
  loading = false,
  error = null,
  onSelectedAccountIdChange,
  onPaymentReferenceChange,
  onPaymentDateChange,
  onClose,
  onConfirm,
}: PostCashInvoiceDialogProps) {
  if (!open) {
    return null;
  }

  const hasAccounts = accountOptions.length > 0;

  const dialog = (
    <div className="fixed inset-0 z-[90] bg-slate-950/45 p-3 sm:p-4">
      <Card
        className={cn(
          "mx-auto mt-8 w-full max-w-lg rounded-xl border border-border/80 bg-card p-0 shadow-[0_14px_40px_rgba(15,23,42,0.18)]",
          "sm:mt-16",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/80 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Post Purchase Invoice</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {`This cash purchase will post ${documentLabel} and record an outflow of ${totalLabel}.`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={loading}
            className="h-8 w-8 shrink-0"
            aria-label="Close cash posting dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="purchase-cash-account">Paid from account</Label>
            <Select
              id="purchase-cash-account"
              value={selectedAccountId}
              onChange={(event) => onSelectedAccountIdChange(event.target.value)}
              disabled={loading || !hasAccounts}
              className="h-8 text-xs"
            >
              <option value="">{hasAccounts ? "Select account" : "No account available"}</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="purchase-cash-reference">Reference / transaction ID</Label>
              <Input
                id="purchase-cash-reference"
                value={paymentReference}
                onChange={(event) => onPaymentReferenceChange(event.target.value)}
                disabled={loading}
                placeholder={documentLabel}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchase-cash-date">Payment date</Label>
              <Input
                id="purchase-cash-date"
                type="date"
                value={paymentDate}
                onChange={(event) => onPaymentDateChange(event.target.value)}
                disabled={loading}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {!hasAccounts ? (
            <div className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-[11px] text-destructive">
              No financial account is available yet. Create or seed at least one cash or bank account before posting this cash invoice.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-[11px] text-destructive">
              {error}
            </div>
          ) : (
            <div className="rounded-md border border-border/70 bg-muted/55 px-3 py-2 text-[11px] text-muted-foreground">
              Confirming will post the invoice, create the payment, and fully settle the invoice immediately.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/80 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={loading || !hasAccounts || !selectedAccountId}
          >
            {loading ? "Working..." : "Confirm & Post"}
          </Button>
        </div>
      </Card>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}
