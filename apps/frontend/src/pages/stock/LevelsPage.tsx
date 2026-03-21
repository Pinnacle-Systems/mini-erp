import { useEffect, useMemo, useState } from "react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
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
  getLocalStockLevels,
  getSyncRejectionFromError,
  syncOnce,
  type StockLevelRow,
} from "../../features/sync/engine";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

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

const toUserStockLevelsErrorMessage = (error: unknown) => {
  const rejection = getSyncRejectionFromError(error);
  if (rejection) {
    return rejection.message;
  }
  if (!(error instanceof Error)) {
    return "Unable to load stock levels right now.";
  }
  return error.message || "Unable to load stock levels right now.";
};

const formatQuantity = (value: number) => value.toFixed(3).replace(/\.?0+$/, "");

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
    const itemOrder = left.itemName.localeCompare(right.itemName);
    if (itemOrder !== 0) return itemOrder;
    return left.variantName.localeCompare(right.variantName);
  });
};

export function LevelsPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [rows, setRows] = useState<StockLevelRow[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedItemQuery = useDebouncedValue(itemQuery, 250);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const localRows = await getLocalStockLevels(activeStore);
        if (!cancelled) {
          setRows(localRows);
        }
        await syncOnce(activeStore);
        const syncedRows = await getLocalStockLevels(activeStore);
        if (!cancelled) {
          setRows(syncedRows);
          setError(null);
        }
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError(toUserStockLevelsErrorMessage(nextError));
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
      setRows(await getLocalStockLevels(activeStore));
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(toUserStockLevelsErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const aggregatedRows = useMemo(() => aggregateBusinessStock(rows), [rows]);
  const trimmedQuery = (itemQuery.trim().length === 0 ? "" : debouncedItemQuery).trim().toLowerCase();
  const filteredRows = aggregatedRows.filter((row) => {
    if (!trimmedQuery) {
      return true;
    }
    const haystacks = [row.itemName, row.variantName, row.sku];
    return haystacks.some((value) => value.toLowerCase().includes(trimmedQuery));
  });

  const uniqueItems = new Set(filteredRows.map((row) => row.itemId)).size;
  const desktopGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1.65fr) minmax(0,1.35fr) minmax(0,0.85fr) minmax(0,0.6fr) minmax(0,0.55fr)",
  );

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>Stock Levels</CardTitle>
        <CardDescription>
          Review the total stock currently available across your business. Quantities are
          grouped by item variant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 lg:flex lg:min-h-0 lg:flex-col">
        <div className="grid gap-3 rounded-lg border border-border/80 bg-muted/55 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="stock-levels-item-filter">Item</Label>
            <Input
              id="stock-levels-item-filter"
              value={itemQuery}
              onChange={(event) => setItemQuery(event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setItemQuery("");
              }}
              disabled={loading && rows.length === 0}
            >
              Clear Filter
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
              ? "No stock rows match the current filter."
              : `${filteredRows.length} variant row${filteredRows.length === 1 ? "" : "s"} across ${uniqueItems} item${uniqueItems === 1 ? "" : "s"}.`}
          </p>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {loading && rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading stock levels...</p>
        ) : null}

        <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <TabularSurface className="min-h-0 flex-1 overflow-hidden">
            <TabularHeader>
              <TabularRow columns={desktopGridTemplate}>
                <TabularSerialNumberHeaderCell />
                <TabularCell variant="header">Item</TabularCell>
                <TabularCell variant="header">Variant</TabularCell>
                <TabularCell variant="header">SKU</TabularCell>
                <TabularCell variant="header" align="end">
                  Qty
                </TabularCell>
                <TabularCell variant="header">UOM</TabularCell>
              </TabularRow>
            </TabularHeader>
            <TabularBody className="overflow-y-auto">
              {filteredRows.map((row, index) => (
                <TabularRow key={row.key} columns={desktopGridTemplate} interactive>
                  <TabularSerialNumberCell index={index} />
                  <TabularCell>
                    <p className="truncate font-semibold text-foreground" title={row.itemName}>
                      {row.itemName}
                    </p>
                  </TabularCell>
                  <TabularCell truncate hoverTitle={row.variantName || "Default variant"}>
                    {row.variantName || "Default variant"}
                  </TabularCell>
                  <TabularCell truncate hoverTitle={row.sku || "—"}>
                    {row.sku || "—"}
                  </TabularCell>
                  <TabularCell align="end" className="font-semibold text-foreground">
                    {formatQuantity(row.quantityOnHand)}
                  </TabularCell>
                  <TabularCell>{row.unit || "—"}</TabularCell>
                </TabularRow>
              ))}
              {filteredRows.length === 0 && !loading ? (
                <TabularRow columns={desktopGridTemplate}>
                  <TabularCell className="col-span-6 text-muted-foreground">
                    Stock will appear here after product movements sync to this device.
                  </TabularCell>
                </TabularRow>
              ) : null}
            </TabularBody>
          </TabularSurface>
        </div>

        <div className="space-y-2 lg:hidden">
          {filteredRows.length === 0 && !loading ? (
            <div className="rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs text-muted-foreground">
              Stock will appear here after product movements sync to this device.
            </div>
          ) : null}
          {filteredRows.map((row) => (
            <div
              key={row.key}
              className="rounded-lg border border-border/80 bg-card px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">{row.itemName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.variantName || "Default variant"}
                    {row.sku ? ` • ${row.sku}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{row.unit}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {formatQuantity(row.quantityOnHand)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
