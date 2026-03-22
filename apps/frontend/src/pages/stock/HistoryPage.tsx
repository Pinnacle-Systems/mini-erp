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
  fetchStockActivityHistory,
  getInitialLocalStockActivityHistory,
  getSyncRejectionFromError,
  syncOnce,
  type StockActivityHistoryRow,
  type StockActivitySourceType,
} from "../../features/sync/engine";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const SOURCE_FILTER_OPTIONS: Array<{
  value: "ALL" | StockActivitySourceType;
  label: string;
}> = [
  { value: "ALL", label: "All activity" },
  { value: "STOCK_ADJUSTMENT", label: "Manual Adjustment" },
  { value: "GOODS_RECEIPT_NOTE", label: "Goods Receipt Note" },
  { value: "PURCHASE_INVOICE", label: "Purchase Invoice" },
  { value: "PURCHASE_RETURN", label: "Purchase Return" },
  { value: "DELIVERY_CHALLAN", label: "Delivery Challan" },
  { value: "SALES_INVOICE", label: "Sales Invoice" },
  { value: "SALES_RETURN", label: "Sales Return" },
];

const STOCK_ACTIVITY_REGISTRY: Record<StockActivitySourceType, { label: string }> = {
  STOCK_ADJUSTMENT: { label: "Manual Adjustment" },
  GOODS_RECEIPT_NOTE: { label: "Goods Receipt Note" },
  PURCHASE_INVOICE: { label: "Purchase Invoice" },
  PURCHASE_RETURN: { label: "Purchase Return" },
  DELIVERY_CHALLAN: { label: "Delivery Challan" },
  SALES_INVOICE: { label: "Sales Invoice" },
  SALES_RETURN: { label: "Sales Return" },
};

const toUserStockHistoryErrorMessage = (error: unknown) => {
  const rejection = getSyncRejectionFromError(error);
  if (rejection) return rejection.message;
  if (!(error instanceof Error)) {
    return "Unable to load stock activity right now.";
  }
  return error.message || "Unable to load stock activity right now.";
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

const toActionLabel = (row: StockActivityHistoryRow) => {
  const base = STOCK_ACTIVITY_REGISTRY[row.sourceType]?.label ?? row.sourceType;
  if (row.sourceAction === "CANCELLED") return `${base} Cancelled`;
  if (row.sourceAction === "REOPENED") return `${base} Reopened`;
  return base;
};

export function HistoryPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [recentRows, setRecentRows] = useState<StockActivityHistoryRow[]>([]);
  const [historicalRows, setHistoricalRows] = useState<StockActivityHistoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"ALL" | StockActivitySourceType>("ALL");
  const [mode, setMode] = useState<"RECENT" | "HISTORICAL">("RECENT");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [auditStartDate, setAuditStartDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setRecentRows([]);
      setHistoricalRows([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const localRows = await getInitialLocalStockActivityHistory(activeStore);
        if (!cancelled) {
          setRecentRows(localRows);
        }
        await syncOnce(activeStore);
        const syncedRows = await getInitialLocalStockActivityHistory(activeStore);
        if (!cancelled) {
          setRecentRows(syncedRows);
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

  useEffect(() => {
    if (mode !== "HISTORICAL" || !activeStore || !isBusinessSelected || isOffline) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchStockActivityHistory(activeStore, {
          q: debouncedQuery.trim() || undefined,
          sourceType: sourceFilter === "ALL" ? undefined : sourceFilter,
        });

        if (!cancelled) {
          setHistoricalRows(result.rows);
          setNextCursor(result.nextCursor);
          setHasMore(result.hasMore);
          setAuditStartDate(result.auditStartDate);
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
  }, [activeStore, debouncedQuery, isBusinessSelected, isOffline, mode, sourceFilter]);

  const onRefresh = async () => {
    if (!activeStore || !isBusinessSelected || loading) return;

    setLoading(true);
    try {
      if (mode === "HISTORICAL") {
        const result = await fetchStockActivityHistory(activeStore, {
          q: debouncedQuery.trim() || undefined,
          sourceType: sourceFilter === "ALL" ? undefined : sourceFilter,
        });
        setHistoricalRows(result.rows);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setAuditStartDate(result.auditStartDate);
      } else {
        await syncOnce(activeStore);
        setRecentRows(await getInitialLocalStockActivityHistory(activeStore));
      }
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(toUserStockHistoryErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const loadOlderActivity = async () => {
    if (!activeStore || !isBusinessSelected || loading || !nextCursor) {
      return;
    }

    setLoading(true);
    try {
      const result = await fetchStockActivityHistory(activeStore, {
        q: debouncedQuery.trim() || undefined,
        sourceType: sourceFilter === "ALL" ? undefined : sourceFilter,
        cursor: nextCursor,
      });
      setHistoricalRows((current) => [...current, ...result.rows]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
      setAuditStartDate(result.auditStartDate);
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(toUserStockHistoryErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const filteredRecentRows = useMemo(
    () =>
      recentRows.filter((row) => {
        if (sourceFilter !== "ALL" && row.sourceType !== sourceFilter) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return [
          row.itemName,
          row.variantName,
          row.sku,
          row.sourceDocumentNumber ?? "",
          STOCK_ACTIVITY_REGISTRY[row.sourceType]?.label ?? row.sourceType,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
    [normalizedQuery, recentRows, sourceFilter],
  );
  const visibleRows = mode === "HISTORICAL" ? historicalRows : filteredRecentRows;

  const desktopGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1.2fr) minmax(0,1.45fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.1fr) minmax(0,0.95fr) minmax(0,0.65fr) minmax(0,0.5fr) minmax(0,0.7fr)",
  );

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>Stock Activity</CardTitle>
        <CardDescription>
          Review recent stock-affecting activity, then load older audit history from the server
          when you need deeper investigation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 lg:flex lg:min-h-0 lg:flex-col">
        <div className="grid gap-3 rounded-lg border border-border/80 bg-muted/55 p-3 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="stock-history-search">Search</Label>
            <Input
              id="stock-history-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={loading}
              placeholder="Item, variant, SKU, or document"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-history-movement">Action Type</Label>
            <Select
              id="stock-history-movement"
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value as "ALL" | StockActivitySourceType)
              }
              disabled={loading}
            >
              {SOURCE_FILTER_OPTIONS.map((option) => (
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
                setSourceFilter("ALL");
              }}
              disabled={loading && visibleRows.length === 0}
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
            {visibleRows.length === 0
              ? "No stock activity matches the current filters."
              : mode === "HISTORICAL"
                ? `${visibleRows.length} historical activit${visibleRows.length === 1 ? "y" : "ies"} loaded.`
                : `${visibleRows.length} recent activit${visibleRows.length === 1 ? "y" : "ies"} in view.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {mode === "RECENT" ? (
              <Button
                type="button"
                variant="outline"
                disabled={!activeStore || !isBusinessSelected || isOffline || loading}
                onClick={() => {
                  setMode("HISTORICAL");
                }}
                title={isOffline ? "Full history is only available online." : undefined}
              >
                View Older Activity
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setMode("RECENT");
                  setHistoricalRows([]);
                  setNextCursor(null);
                  setHasMore(false);
                }}
              >
                Back to Recent
              </Button>
            )}
          </div>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {isOffline && mode === "RECENT" ? (
          <p className="text-xs text-muted-foreground">
            Full history is only available online. Showing recent synced activity.
          </p>
        ) : null}
        {loading && visibleRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading stock activity...</p>
        ) : null}

        <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <TabularSurface className="min-h-0 flex-1 overflow-hidden">
            <TabularHeader>
              <TabularRow columns={desktopGridTemplate}>
                <TabularSerialNumberHeaderCell />
                <TabularCell variant="header">When</TabularCell>
                <TabularCell variant="header">Item</TabularCell>
                <TabularCell variant="header">Variant</TabularCell>
                <TabularCell variant="header">Location</TabularCell>
                <TabularCell variant="header">Action</TabularCell>
                <TabularCell variant="header">Document</TabularCell>
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
              {visibleRows.map((row, index) => (
                <TabularRow key={row.entityId} columns={desktopGridTemplate} interactive>
                  <TabularSerialNumberCell index={index} />
                  <TabularCell truncate hoverTitle={formatTimestamp(row.occurredAt)}>
                    {formatTimestamp(row.occurredAt)}
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
                  <TabularCell>{toActionLabel(row)}</TabularCell>
                  <TabularCell truncate hoverTitle={row.sourceDocumentNumber || "Manual entry"}>
                    {row.sourceDocumentNumber || "Manual entry"}
                  </TabularCell>
                  <TabularCell
                    align="end"
                    className={
                      row.quantityDelta < 0
                        ? "font-semibold text-destructive"
                        : "font-semibold text-foreground"
                    }
                  >
                    {row.quantityDelta < 0 ? "-" : "+"}
                    {formatQuantity(row.quantityDelta)}
                  </TabularCell>
                  <TabularCell>{row.unit}</TabularCell>
                  <TabularCell align="end" className="font-semibold text-foreground">
                    {formatQuantity(row.quantityOnHandAfter)}
                  </TabularCell>
                </TabularRow>
              ))}
              {visibleRows.length === 0 && !loading ? (
                <TabularRow columns={desktopGridTemplate}>
                  <TabularCell className="col-span-10 text-muted-foreground">
                    Stock activity will appear here after inventory changes are recorded.
                  </TabularCell>
                </TabularRow>
              ) : null}
            </TabularBody>
          </TabularSurface>
        </div>

        <div className="space-y-2 lg:hidden">
          {visibleRows.length === 0 && !loading ? (
            <div className="rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs text-muted-foreground">
              Stock activity will appear here after inventory changes are recorded.
            </div>
          ) : null}
          {visibleRows.map((row) => (
            <div
              key={row.entityId}
              className="rounded-lg border border-border/80 bg-card px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">{row.itemName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.variantName || "Default variant"}
                    {row.sku ? ` • ${row.sku}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.locationName || "Unknown location"} • {toActionLabel(row)} •{" "}
                    {formatTimestamp(row.occurredAt)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.sourceDocumentNumber || "Manual entry"} • On hand after:{" "}
                    {formatQuantity(row.quantityOnHandAfter)} {row.unit}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    row.quantityDelta < 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {row.quantityDelta < 0 ? "-" : "+"}
                  {formatQuantity(row.quantityDelta)} {row.unit}
                </p>
              </div>
            </div>
          ))}
        </div>

        {mode === "HISTORICAL" ? (
          <div className="space-y-2">
            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void loadOlderActivity();
                }}
                disabled={loading || !nextCursor}
              >
                {loading ? "Loading..." : "Load Older Activity"}
              </Button>
            ) : null}
            {auditStartDate ? (
              <div className="rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs text-muted-foreground">
                Full stock activity tracking began on {formatTimestamp(auditStartDate)}. Older
                activity is not available in this audit trail.
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
