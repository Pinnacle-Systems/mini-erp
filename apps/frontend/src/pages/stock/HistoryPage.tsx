import { useEffect, useMemo, useState } from "react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../../design-system/molecules/DenseTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import { useSessionStore } from "../../features/auth/session-business";
import {
  getLocalStockAdjustmentHistory,
  getSyncRejectionFromError,
  syncOnce,
  type StockAdjustmentHistoryRow,
  type StockAdjustmentReason,
} from "../../features/sync/engine";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const MOVEMENT_FILTER_OPTIONS: Array<{
  value: "ALL" | StockAdjustmentReason;
  label: string;
}> = [
  { value: "ALL", label: "All movements" },
  { value: "OPENING_BALANCE", label: "Opening Balance" },
  { value: "ADJUSTMENT_INCREASE", label: "Stock In" },
  { value: "ADJUSTMENT_DECREASE", label: "Stock Out" },
];

const toUserStockHistoryErrorMessage = (error: unknown) => {
  const rejection = getSyncRejectionFromError(error);
  if (rejection) return rejection.message;
  if (!(error instanceof Error)) {
    return "Unable to load stock adjustment history right now.";
  }
  return error.message || "Unable to load stock adjustment history right now.";
};

const formatQuantity = (value: number) => Math.abs(value).toFixed(3).replace(/\.?0+$/, "");

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const toMovementLabel = (reason: StockAdjustmentReason) => {
  if (reason === "ADJUSTMENT_INCREASE") return "Stock In";
  if (reason === "ADJUSTMENT_DECREASE") return "Stock Out";
  return "Opening Balance";
};

export function HistoryPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [rows, setRows] = useState<StockAdjustmentHistoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [movementFilter, setMovementFilter] = useState<"ALL" | StockAdjustmentReason>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const localRows = await getLocalStockAdjustmentHistory(activeStore);
        if (!cancelled) {
          setRows(localRows);
        }
        await syncOnce(activeStore);
        const syncedRows = await getLocalStockAdjustmentHistory(activeStore);
        if (!cancelled) {
          setRows(syncedRows);
          setError(null);
        }
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError(toUserStockHistoryErrorMessage(nextError));
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

  const onRefresh = async () => {
    if (!activeStore || !isBusinessSelected || loading) return;

    setLoading(true);
    try {
      await syncOnce(activeStore);
      setRows(await getLocalStockAdjustmentHistory(activeStore));
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(toUserStockHistoryErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const normalizedQuery = (query.trim().length === 0 ? "" : debouncedQuery).trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (movementFilter !== "ALL" && row.reason !== movementFilter) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return [row.itemName, row.variantName, row.sku]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
    [movementFilter, normalizedQuery, rows],
  );

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>Adjustment History</CardTitle>
        <CardDescription>
          Review recent stock adjustments synced to this device. History is retained locally as
          the most recent 10 adjustments per variant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 lg:flex lg:min-h-0 lg:flex-col">
        <div className="grid gap-3 border border-border/80 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="stock-history-search">Search</Label>
            <Input
              id="stock-history-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={loading}
              placeholder="Item, variant, or SKU"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-history-movement">Movement</Label>
            <Select
              id="stock-history-movement"
              value={movementFilter}
              onChange={(event) =>
                setMovementFilter(event.target.value as "ALL" | StockAdjustmentReason)
              }
              disabled={loading}
            >
              {MOVEMENT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery("");
                setMovementFilter("ALL");
              }}
              disabled={loading && rows.length === 0}
            >
              Clear Filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void onRefresh();
              }}
              disabled={!activeStore || !isBusinessSelected || loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {filteredRows.length === 0
              ? "No recent adjustments match the current filters."
              : `${filteredRows.length} recent adjustment${filteredRows.length === 1 ? "" : "s"} in view.`}
          </p>
        </div>

        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        {loading && rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading stock adjustment history...</p>
        ) : null}

        <DenseTable className="lg:flex-1">
          <DenseTableHead>
            <DenseTableRow>
              <DenseTableHeaderCell className="w-[22%]">When</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[24%]">Item</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[16%]">Variant</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[12%]">Location</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[12%]">Movement</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[8%] text-right">Qty</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[6%]">Unit</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[10%] text-right">On Hand</DenseTableHeaderCell>
            </DenseTableRow>
          </DenseTableHead>
          <DenseTableBody>
            {filteredRows.map((row) => (
              <DenseTableRow key={row.entityId}>
                <DenseTableCell className="text-muted-foreground">
                  {formatTimestamp(row.createdAt)}
                </DenseTableCell>
                <DenseTableCell>
                  <div>
                    <p className="font-semibold text-foreground">{row.itemName}</p>
                    <p className="text-[10px] text-muted-foreground">{row.sku || "—"}</p>
                  </div>
                </DenseTableCell>
                <DenseTableCell className="text-muted-foreground">
                  {row.variantName || "Default variant"}
                </DenseTableCell>
                <DenseTableCell className="text-muted-foreground">
                  {row.locationName || "—"}
                </DenseTableCell>
                <DenseTableCell className="text-muted-foreground">
                  {toMovementLabel(row.reason)}
                </DenseTableCell>
                <DenseTableCell
                  className={`text-right font-semibold ${
                    row.quantity < 0 ? "text-red-700" : "text-foreground"
                  }`}
                >
                  {row.quantity < 0 ? "-" : "+"}
                  {formatQuantity(row.quantity)}
                </DenseTableCell>
                <DenseTableCell className="text-muted-foreground">{row.unit}</DenseTableCell>
                <DenseTableCell className="text-right font-semibold text-foreground">
                  {formatQuantity(row.quantityOnHand)}
                </DenseTableCell>
              </DenseTableRow>
            ))}
            {filteredRows.length === 0 && !loading ? (
              <DenseTableRow>
                <DenseTableCell colSpan={8} className="text-muted-foreground">
                  Recent stock adjustments will appear here after inventory changes sync to this
                  device.
                </DenseTableCell>
              </DenseTableRow>
            ) : null}
          </DenseTableBody>
        </DenseTable>

        <div className="space-y-2 lg:hidden">
          {filteredRows.length === 0 && !loading ? (
            <div className="rounded-lg border border-border/80 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
              Recent stock adjustments will appear here after inventory changes sync to this
              device.
            </div>
          ) : null}
          {filteredRows.map((row) => (
            <div
              key={row.entityId}
              className="rounded-lg border border-border/80 bg-white px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">{row.itemName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.variantName || "Default variant"}
                    {row.sku ? ` • ${row.sku}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.locationName || "Unknown location"} • {toMovementLabel(row.reason)} •{" "}
                    {formatTimestamp(row.createdAt)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    On hand after: {formatQuantity(row.quantityOnHand)} {row.unit}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    row.quantity < 0 ? "text-red-700" : "text-foreground"
                  }`}
                >
                  {row.quantity < 0 ? "-" : "+"}
                  {formatQuantity(row.quantity)} {row.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
