import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../design-system/atoms/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
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
import { useSessionStore } from "../../features/auth/session-business";
import {
  getInitialLocalStockActivityHistory,
  getLocalStockLevels,
  getSyncRejectionFromError,
  syncOnce,
  type StockActivityHistoryRow,
  type StockActivitySourceType,
  type StockLevelRow,
} from "../../features/sync/engine";
import { useConnectivity } from "../../hooks/useConnectivity";

type BusinessStockRow = {
  key: string;
  itemId: string;
  variantId: string;
  itemName: string;
  variantName: string;
  sku: string;
  unit: string;
  quantityOnHand: number;
};

const LOW_STOCK_THRESHOLD = 5;

const STOCK_ACTIVITY_REGISTRY: Record<StockActivitySourceType, { label: string }> = {
  STOCK_ADJUSTMENT: { label: "Manual Adjustment" },
  GOODS_RECEIPT_NOTE: { label: "Goods Receipt" },
  PURCHASE_INVOICE: { label: "Purchase Invoice" },
  PURCHASE_RETURN: { label: "Purchase Return" },
  DELIVERY_CHALLAN: { label: "Delivery Challan" },
  SALES_INVOICE: { label: "Sales Invoice" },
  SALES_RETURN: { label: "Sales Return" },
};

const toUserStockOverviewErrorMessage = (error: unknown) => {
  const rejection = getSyncRejectionFromError(error);
  if (rejection) return rejection.message;
  if (!(error instanceof Error)) return "Unable to load stock overview right now.";
  return error.message || "Unable to load stock overview right now.";
};

const formatQuantity = (value: number) => Math.abs(value).toFixed(3).replace(/\.?0+$/, "");

const formatSignedQuantity = (value: number) =>
  `${value < 0 ? "-" : "+"}${formatQuantity(value)}`;

const formatTime = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const isToday = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  );
};

const aggregateBusinessStock = (rows: StockLevelRow[]): BusinessStockRow[] => {
  const byVariant = new Map<string, BusinessStockRow>();

  for (const row of rows) {
    const key = row.variantId || row.entityId;
    const existing = byVariant.get(key);

    if (!existing) {
      byVariant.set(key, {
        key,
        itemId: row.itemId,
        variantId: row.variantId,
        itemName: row.itemName,
        variantName: row.variantName,
        sku: row.sku,
        unit: row.unit,
        quantityOnHand: row.quantityOnHand,
      });
      continue;
    }

    existing.quantityOnHand += row.quantityOnHand;
  }

  return Array.from(byVariant.values()).sort((left, right) => {
    const quantityOrder = left.quantityOnHand - right.quantityOnHand;
    if (quantityOrder !== 0) return quantityOrder;
    const itemOrder = left.itemName.localeCompare(right.itemName);
    if (itemOrder !== 0) return itemOrder;
    return left.variantName.localeCompare(right.variantName);
  });
};

const getAttentionReason = (row: BusinessStockRow) => {
  if (row.quantityOnHand < 0) return "Negative stock";
  if (row.quantityOnHand === 0) return "Out of stock";
  if (row.quantityOnHand <= LOW_STOCK_THRESHOLD) return "Low stock";
  return null;
};

const toActionLabel = (row: StockActivityHistoryRow) => {
  const base = STOCK_ACTIVITY_REGISTRY[row.sourceType]?.label ?? row.sourceType;
  if (row.sourceAction === "CANCELLED") return `${base} Cancelled`;
  if (row.sourceAction === "REOPENED") return `${base} Reopened`;
  return base;
};

export function OverviewPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [stockLevels, setStockLevels] = useState<StockLevelRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<StockActivityHistoryRow[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOnline, classifyError } = useConnectivity();

  const load = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;

    setLoading(true);
    try {
      const [localLevels, localActivity] = await Promise.all([
        getLocalStockLevels(activeStore),
        getInitialLocalStockActivityHistory(activeStore),
      ]);
      setStockLevels(localLevels);
      setRecentActivity(localActivity);

      if (isOnline) {
        await syncOnce(activeStore);
        const [syncedLevels, syncedActivity] = await Promise.all([
          getLocalStockLevels(activeStore),
          getInitialLocalStockActivityHistory(activeStore),
        ]);
        setStockLevels(syncedLevels);
        setRecentActivity(syncedActivity);
      }

      setLastUpdatedAt(new Date().toISOString());
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(
        classifyError(nextError).isConnectivityError
          ? "Showing local stock data. Fresh sync will resume when the connection recovers."
          : toUserStockOverviewErrorMessage(nextError),
      );
    } finally {
      setLoading(false);
    }
  }, [activeStore, classifyError, isBusinessSelected, isOnline]);

  useEffect(() => {
    void load();
  }, [load]);

  const overview = useMemo(() => {
    const rows = aggregateBusinessStock(stockLevels);
    const attentionRows = rows
      .filter((row) => getAttentionReason(row))
      .sort((left, right) => left.quantityOnHand - right.quantityOnHand)
      .slice(0, 8);
    const todayActivity = recentActivity.filter((row) => isToday(row.occurredAt));
    const inboundToday = todayActivity
      .filter((row) => row.quantityDelta > 0)
      .reduce((total, row) => total + row.quantityDelta, 0);
    const outboundToday = todayActivity
      .filter((row) => row.quantityDelta < 0)
      .reduce((total, row) => total + Math.abs(row.quantityDelta), 0);

    const locationSummary = Array.from(
      recentActivity.reduce<Map<string, { key: string; label: string; count: number; netQty: number }>>(
        (acc, row) => {
          const key = row.locationId || row.locationName || "unknown";
          const existing = acc.get(key) ?? {
            key,
            label: row.locationName || "Unknown location",
            count: 0,
            netQty: 0,
          };
          existing.count += 1;
          existing.netQty += row.quantityDelta;
          acc.set(key, existing);
          return acc;
        },
        new Map(),
      ).values(),
    )
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);

    const movementSummary = Array.from(
      recentActivity.reduce<Map<StockActivitySourceType, { key: StockActivitySourceType; label: string; count: number }>>(
        (acc, row) => {
          const existing = acc.get(row.sourceType) ?? {
            key: row.sourceType,
            label: STOCK_ACTIVITY_REGISTRY[row.sourceType]?.label ?? row.sourceType,
            count: 0,
          };
          existing.count += 1;
          acc.set(row.sourceType, existing);
          return acc;
        },
        new Map(),
      ).values(),
    )
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);

    return {
      rows,
      attentionRows,
      todayActivity,
      inboundToday,
      outboundToday,
      locationSummary,
      movementSummary,
    };
  }, [recentActivity, stockLevels]);

  const metrics = [
    {
      label: "Stocked Variants",
      value: overview.rows.length,
      title: "variants with synced stock rows",
    },
    {
      label: "Items in Stock View",
      value: new Set(overview.rows.map((row) => row.itemId)).size,
      title: "unique items represented in stock levels",
    },
    {
      label: "Needs Attention",
      value: overview.attentionRows.length,
      title: `negative, zero, or stock at ${LOW_STOCK_THRESHOLD} units or below`,
    },
    {
      label: "Inbound Today",
      value: formatQuantity(overview.inboundToday),
      title: "positive stock movement recorded today",
    },
    {
      label: "Outbound Today",
      value: formatQuantity(overview.outboundToday),
      title: "negative stock movement recorded today",
    },
    {
      label: "Activity Today",
      value: overview.todayActivity.length,
      title: "stock-affecting activity recorded today",
    },
  ];

  const attentionGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1.5fr) minmax(0,1.15fr) minmax(0,0.85fr) minmax(0,0.75fr) minmax(0,0.8fr)",
  );
  const activityGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1.05fr) minmax(0,1.35fr) minmax(0,1fr) minmax(0,0.8fr) minmax(0,0.7fr) minmax(0,0.55fr) minmax(0,0.95fr)",
  );

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <CardTitle>Stock Overview</CardTitle>
              <CardDescription>
                Monitor stock position, exceptions, and recent stock-affecting activity.
                {lastUpdatedAt ? (
                  <span className="ml-2 border-l border-border/80 pl-2 text-[10px]">
                    Last updated: {formatTime(lastUpdatedAt)}
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              disabled={!activeStore || !isBusinessSelected || loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              title={metric.title}
              className="min-w-0 rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2"
            >
              <p className="truncate text-[10px] text-muted-foreground">{metric.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{metric.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2 text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <p className="text-xs">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Needs Attention</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              <div className="space-y-2 lg:hidden">
                {overview.attentionRows.length === 0 && !loading ? (
                  <p className="p-2 text-xs text-muted-foreground">No low or negative stock rows.</p>
                ) : null}
                {overview.attentionRows.map((row) => (
                  <div key={row.key} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.itemName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.variantName || "Default variant"}
                          {row.sku ? ` - ${row.sku}` : ""}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatQuantity(row.quantityOnHand)} {row.unit}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-destructive">{getAttentionReason(row)}</p>
                  </div>
                ))}
              </div>
              <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
                  <TabularHeader>
                    <TabularRow columns={attentionGridTemplate}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Item</TabularCell>
                      <TabularCell variant="header">Variant</TabularCell>
                      <TabularCell variant="header">SKU</TabularCell>
                      <TabularCell variant="header">Reason</TabularCell>
                      <TabularCell variant="header" align="end">
                        Qty
                      </TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {overview.attentionRows.length === 0 && !loading ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No low or negative stock rows.
                      </div>
                    ) : null}
                    {overview.attentionRows.map((row, index) => (
                      <TabularRow key={row.key} columns={attentionGridTemplate} interactive>
                        <TabularSerialNumberCell index={index} />
                        <TabularCell truncate hoverTitle={row.itemName}>
                          {row.itemName}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.variantName || "Default variant"}>
                          {row.variantName || "Default variant"}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.sku || "-"}>
                          {row.sku || "-"}
                        </TabularCell>
                        <TabularCell className="font-medium text-destructive">
                          {getAttentionReason(row)}
                        </TabularCell>
                        <TabularCell align="end" className="font-semibold text-foreground">
                          {formatQuantity(row.quantityOnHand)} {row.unit}
                        </TabularCell>
                      </TabularRow>
                    ))}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Stock Activity</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              <div className="space-y-2 lg:hidden">
                {recentActivity.length === 0 && !loading ? (
                  <p className="p-2 text-xs text-muted-foreground">
                    Stock activity will appear here after inventory changes are recorded.
                  </p>
                ) : null}
                {recentActivity.map((row) => (
                  <div key={row.entityId} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.itemName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.variantName || "Default variant"} - {row.locationName || "Unknown location"}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-semibold ${
                          row.quantityDelta < 0 ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {formatSignedQuantity(row.quantityDelta)} {row.unit}
                      </p>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{toActionLabel(row)}</span>
                      <span>{formatTime(row.occurredAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
                  <TabularHeader>
                    <TabularRow columns={activityGridTemplate}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">When</TabularCell>
                      <TabularCell variant="header">Item</TabularCell>
                      <TabularCell variant="header">Variant</TabularCell>
                      <TabularCell variant="header">Location</TabularCell>
                      <TabularCell variant="header" align="end">
                        Qty
                      </TabularCell>
                      <TabularCell variant="header">Unit</TabularCell>
                      <TabularCell variant="header">Source</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {recentActivity.length === 0 && !loading ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Stock activity will appear here after inventory changes are recorded.
                      </div>
                    ) : null}
                    {recentActivity.map((row, index) => (
                      <TabularRow key={row.entityId} columns={activityGridTemplate} interactive>
                        <TabularSerialNumberCell index={index} />
                        <TabularCell truncate hoverTitle={formatTime(row.occurredAt)}>
                          {formatTime(row.occurredAt)}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.itemName}>
                          {row.itemName}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.variantName || "Default variant"}>
                          {row.variantName || "Default variant"}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.locationName || "Unknown location"}>
                          {row.locationName || "Unknown location"}
                        </TabularCell>
                        <TabularCell
                          align="end"
                          className={
                            row.quantityDelta < 0
                              ? "font-semibold text-destructive"
                              : "font-semibold text-foreground"
                          }
                        >
                          {formatSignedQuantity(row.quantityDelta)}
                        </TabularCell>
                        <TabularCell>{row.unit}</TabularCell>
                        <TabularCell truncate hoverTitle={toActionLabel(row)}>
                          {toActionLabel(row)}
                        </TabularCell>
                      </TabularRow>
                    ))}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-2">
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Location Activity</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 space-y-2 overflow-y-auto">
              {overview.locationSummary.length === 0 && !loading ? (
                <p className="p-2 text-xs text-muted-foreground">No recent location activity.</p>
              ) : null}
              {overview.locationSummary.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{entry.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.count} recent movement{entry.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${
                      entry.netQty < 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {formatSignedQuantity(entry.netQty)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Movement Mix</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 space-y-2 overflow-y-auto">
              {overview.movementSummary.length === 0 && !loading ? (
                <p className="p-2 text-xs text-muted-foreground">No recent movement mix available.</p>
              ) : null}
              {overview.movementSummary.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 truncate font-medium text-foreground">{entry.label}</span>
                  <span className="font-semibold text-foreground">{entry.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
