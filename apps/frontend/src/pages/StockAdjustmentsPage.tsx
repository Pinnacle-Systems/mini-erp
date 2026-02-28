import { useEffect, useState } from "react";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Label } from "../design-system/atoms/Label";
import { Select } from "../design-system/atoms/Select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";
import { useSessionStore } from "../features/auth/session-business";
import {
  getLocalStockVariantOptions,
  getSyncRejectionFromError,
  queueStockAdjustmentCreate,
  syncOnce,
  type StockAdjustmentReason,
  type StockVariantOption,
} from "../features/sync/engine";

const STOCK_REASON_OPTIONS: Array<{
  value: StockAdjustmentReason;
  label: string;
}> = [
  { value: "OPENING_BALANCE", label: "Opening Balance" },
  { value: "ADJUSTMENT_INCREASE", label: "Stock In" },
  { value: "ADJUSTMENT_DECREASE", label: "Stock Out" },
];

const toUserStockErrorMessage = (error: unknown) => {
  const rejection = getSyncRejectionFromError(error);
  if (
    rejection?.reasonCode === "DEPENDENCY_MISSING" &&
    rejection.entity === "item_variant"
  ) {
    return "The selected item variant is no longer available. Refresh and pick another item.";
  }
  if (
    rejection?.reasonCode === "VALIDATION_FAILED" &&
    rejection.entity === "stock_adjustment" &&
    rejection.message === "Stock adjustment would make on-hand quantity negative"
  ) {
    const current = Number(rejection.details?.currentQuantityOnHand ?? 0);
    return `This decrease would make stock go negative. Current on-hand is ${current}.`;
  }
  if (!(error instanceof Error)) {
    return "Unable to record stock adjustment right now.";
  }
  return error.message || "Unable to record stock adjustment right now.";
};

export function StockAdjustmentsPage() {
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [options, setOptions] = useState<StockVariantOption[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [reason, setReason] = useState<StockAdjustmentReason>("OPENING_BALANCE");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setOptions([]);
      setSelectedVariantId("");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await syncOnce(activeStore);
        const nextOptions = await getLocalStockVariantOptions(activeStore);
        if (cancelled) return;
        setOptions(nextOptions);
        setSelectedVariantId((current) =>
          nextOptions.some((option) => option.variantId === current)
            ? current
            : (nextOptions[0]?.variantId ?? ""),
        );
        setError(null);
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError(toUserStockErrorMessage(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeStore, isBusinessSelected]);

  const onSubmit = async () => {
    if (!activeStore || !identityId || !isBusinessSelected || loading) return;
    if (!selectedVariantId) {
      setError("Select an item variant first.");
      return;
    }

    const parsedQuantity = Number(quantity.trim());
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await queueStockAdjustmentCreate(activeStore, identityId, {
        variantId: selectedVariantId,
        quantity: parsedQuantity,
        reason,
      });
      await syncOnce(activeStore);
      setQuantity("");
      setMessage(
        navigator.onLine
          ? "Stock adjustment recorded."
          : "Stock adjustment queued offline and will sync automatically.",
      );
    } catch (nextError) {
      console.error(nextError);
      setError(toUserStockErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Adjustments</CardTitle>
        <CardDescription>
          Record product movements for the business. Use increase and decrease entries to
          track stock coming in or going out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="stock-variant">Item Variant</Label>
          <Select
            id="stock-variant"
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            disabled={loading || options.length === 0}
          >
            {options.length === 0 ? (
              <option value="">No synced item variants available</option>
            ) : null}
            {options.map((option) => (
              <option key={option.variantId} value={option.variantId}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock-reason">Movement Type</Label>
          <Select
            id="stock-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as StockAdjustmentReason)}
            disabled={loading}
          >
            {STOCK_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock-quantity">Quantity</Label>
          <Input
            id="stock-quantity"
            inputMode="decimal"
            placeholder="e.g. 25"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={loading || options.length === 0}
          />
        </div>

        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        {message ? <p className="text-xs text-emerald-700">{message}</p> : null}

        <Button
          type="button"
          onClick={() => {
            void onSubmit();
          }}
          disabled={!identityId || !activeStore || !isBusinessSelected || options.length === 0 || loading}
        >
          {loading ? "Saving..." : "Record Stock Adjustment"}
        </Button>
      </CardContent>
    </Card>
  );
}
