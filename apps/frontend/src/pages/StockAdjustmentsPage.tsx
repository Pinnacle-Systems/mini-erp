import { useEffect, useState } from "react";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Label } from "../design-system/atoms/Label";
import { Select } from "../design-system/atoms/Select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";
import { useSessionStore } from "../features/auth/session-business";
import {
  getLocalStockLocations,
  getLocalStockVariantOptions,
  getSyncRejectionFromError,
  queueLocationCreate,
  queueLocationUpdate,
  queueStockAdjustmentCreate,
  syncOnce,
  type StockAdjustmentReason,
  type StockLocationOption,
  type StockVariantOption,
} from "../features/sync/engine";

const STOCK_REASON_OPTIONS: Array<{
  value: StockAdjustmentReason;
  label: string;
}> = [
  { value: "OPENING_BALANCE", label: "Opening Balance" },
  { value: "ADJUSTMENT_INCREASE", label: "Adjustment Increase" },
  { value: "ADJUSTMENT_DECREASE", label: "Adjustment Decrease" },
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
  const [locations, setLocations] = useState<StockLocationOption[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [reason, setReason] = useState<StockAdjustmentReason>("OPENING_BALANCE");
  const [locationName, setLocationName] = useState("");
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
        const [nextOptions, nextLocations] = await Promise.all([
          getLocalStockVariantOptions(activeStore),
          getLocalStockLocations(activeStore),
        ]);
        if (cancelled) return;
        setOptions(nextOptions);
        setLocations(nextLocations);
        setSelectedVariantId((current) =>
          nextOptions.some((option) => option.variantId === current)
            ? current
            : (nextOptions[0]?.variantId ?? ""),
        );
        setSelectedLocationId((current) =>
          nextLocations.some((option) => option.locationId === current) ? current : "",
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

  useEffect(() => {
    const selectedLocation = locations.find(
      (location) => location.locationId === selectedLocationId,
    );
    setLocationName(selectedLocation?.name ?? "");
  }, [locations, selectedLocationId]);

  const refreshLocations = async (tenantId: string) => {
    const nextLocations = await getLocalStockLocations(tenantId);
    setLocations(nextLocations);
    setSelectedLocationId((current) => {
      if (!current) return "";
      return nextLocations.some((location) => location.locationId === current)
        ? current
        : "";
    });
    return nextLocations;
  };

  const onCreateLocation = async () => {
    if (!activeStore || !identityId || !isBusinessSelected || loading) return;
    const trimmedName = locationName.trim();
    if (!trimmedName) {
      setError("Enter a location name to create.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const newLocationId = await queueLocationCreate(activeStore, identityId, trimmedName);
      await syncOnce(activeStore);
      const nextLocations = await refreshLocations(activeStore);
      setSelectedLocationId(
        nextLocations.find((location) => location.locationId === newLocationId)?.locationId ??
          newLocationId,
      );
      setMessage(
        navigator.onLine
          ? "Location created."
          : "Location queued offline and will sync automatically.",
      );
    } catch (nextError) {
      console.error(nextError);
      setError(toUserStockErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const onRenameLocation = async () => {
    if (!activeStore || !identityId || !isBusinessSelected || loading) return;
    if (!selectedLocationId) {
      setError("Select a location to rename.");
      return;
    }
    const trimmedName = locationName.trim();
    if (!trimmedName) {
      setError("Enter a location name to rename.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await queueLocationUpdate(activeStore, identityId, selectedLocationId, trimmedName);
      await syncOnce(activeStore);
      await refreshLocations(activeStore);
      setMessage(
        navigator.onLine
          ? "Location renamed."
          : "Location rename queued offline and will sync automatically.",
      );
    } catch (nextError) {
      console.error(nextError);
      setError(toUserStockErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async () => {
    if (!activeStore || !identityId || !isBusinessSelected || loading) return;
    if (!selectedVariantId) {
      setError("Select an item variant first.");
      return;
    }

    const parsedQuantity = Number(quantity.trim());
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Opening stock must be a positive number.");
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
        ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
      });
      await syncOnce(activeStore);
      const nextLocations = await getLocalStockLocations(activeStore);
      setLocations(nextLocations);
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
          Record opening balances and manual stock adjustments. If no location is selected,
          the backend uses the default main store.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="stock-location">Location</Label>
          <Select
            id="stock-location"
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
            disabled={loading}
          >
            <option value="">Default: Main Store</option>
            {locations.map((location) => (
              <option key={location.locationId} value={location.locationId}>
                {location.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock-location-name">Location Name</Label>
          <Input
            id="stock-location-name"
            placeholder="Create or rename a location"
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            disabled={loading}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void onCreateLocation();
              }}
              disabled={!identityId || !activeStore || !isBusinessSelected || loading}
            >
              Create Location
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void onRenameLocation();
              }}
              disabled={
                !identityId ||
                !activeStore ||
                !isBusinessSelected ||
                !selectedLocationId ||
                loading
              }
            >
              Rename Selected
            </Button>
          </div>
        </div>

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
          <Label htmlFor="stock-reason">Adjustment Type</Label>
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
