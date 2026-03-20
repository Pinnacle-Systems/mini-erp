import { useEffect, useMemo, useState } from "react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import {
  TabularBody,
  TabularCell,
  TabularHeader,
  TabularRow,
  TabularSerialNumberCell,
  TabularSerialNumberHeaderCell,
  TabularSurface,
} from "../../design-system/molecules/TabularSurface";
import { withTabularSerialNumberColumn } from "../../design-system/molecules/tabularSerialNumbers";
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
  const desktopGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1.35fr) minmax(0,1.55fr) minmax(0,1.25fr) minmax(0,0.9fr) minmax(0,0.95fr) minmax(0,0.65fr) minmax(0,0.5fr) minmax(0,0.8fr)",
  );

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>Stock History</CardTitle>
        <CardDescription>
          Review recent stock movements for your items, including opening balances, stock in,
          and stock out entries.
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
              ? "No stock movements match the current filters."
              : `${filteredRows.length} recent movement${filteredRows.length === 1 ? "" : "s"} in view.`}
          </p>
        </div>

        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        {loading && rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading stock history...</p>
        ) : null}

        <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <TabularSurface className="min-h-0 flex-1 overflow-hidden bg-white">
            <TabularHeader>
              <TabularRow columns={desktopGridTemplate}>
                <TabularSerialNumberHeaderCell />
                <TabularCell variant="header">When</TabularCell>
                <TabularCell variant="header">Item</TabularCell>
                <TabularCell variant="header">Variant</TabularCell>
                <TabularCell variant="header">Location</TabularCell>
                <TabularCell variant="header">Movement</TabularCell>
                <TabularCell variant="header" align="end">
                  Qty
                </TabularCell>
                <TabularCell variant="header">Unit</TabularCell>
                <TabularCell variant="header" align="end">
                  On Hand
                </TabularCell>
              </TabularRow>
            </TabularHeader>
            <TabularBody className="overflow-y-auto">
              {filteredRows.map((row, index) => (
                <TabularRow key={row.entityId} columns={desktopGridTemplate} interactive>
                  <TabularSerialNumberCell index={index} />
                  <TabularCell truncate hoverTitle={formatTimestamp(row.createdAt)}>
                    {formatTimestamp(row.createdAt)}
                  </TabularCell>
                  <TabularCell>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground" title={row.itemName}>
                        {row.itemName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{row.sku || "—"}</p>
                    </div>
                  </TabularCell>
                  <TabularCell truncate hoverTitle={row.variantName || "Default variant"}>
                    {row.variantName || "Default variant"}
                  </TabularCell>
                  <TabularCell truncate hoverTitle={row.locationName || "—"}>
                    {row.locationName || "—"}
                  </TabularCell>
                  <TabularCell>{toMovementLabel(row.reason)}</TabularCell>
                  <TabularCell
                    align="end"
                    className={row.quantity < 0 ? "font-semibold text-red-700" : "font-semibold text-foreground"}
                  >
                    {row.quantity < 0 ? "-" : "+"}
                    {formatQuantity(row.quantity)}
                  </TabularCell>
                  <TabularCell>{row.unit}</TabularCell>
                  <TabularCell align="end" className="font-semibold text-foreground">
                    {formatQuantity(row.quantityOnHand)}
                  </TabularCell>
                </TabularRow>
              ))}
              {filteredRows.length === 0 && !loading ? (
                <TabularRow columns={desktopGridTemplate}>
                  <TabularCell className="col-span-9 text-muted-foreground">
                    Recent stock movements will appear here after inventory changes are recorded.
                  </TabularCell>
                </TabularRow>
              ) : null}
            </TabularBody>
          </TabularSurface>
        </div>

        <div className="space-y-2 lg:hidden">
          {filteredRows.length === 0 && !loading ? (
            <div className="rounded-lg border border-border/80 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
              Recent stock movements will appear here after inventory changes are recorded.
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
