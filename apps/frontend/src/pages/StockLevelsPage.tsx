import { useEffect, useState } from "react";
import { Button } from "../design-system/atoms/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";
import { useSessionStore } from "../features/auth/session-business";
import {
  getLocalStockLevels,
  getSyncRejectionFromError,
  syncOnce,
  type StockLevelRow,
} from "../features/sync/engine";

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

export function StockLevelsPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [rows, setRows] = useState<StockLevelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Levels</CardTitle>
        <CardDescription>
          Current on-hand stock is derived by the backend and synced to this device as
          `stock_level` snapshots.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {rows.length === 0 ? "No stock has been recorded yet." : `${rows.length} stock row${rows.length === 1 ? "" : "s"} synced.`}
          </p>
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

        {error ? <p className="text-xs text-red-700">{error}</p> : null}

        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.entityId}
              className="rounded-xl border border-[#d8e4f0] bg-white px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">{row.itemName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.variantName || "Default variant"}
                    {row.sku ? ` • ${row.sku}` : ""}
                    {` • ${row.locationName}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {row.quantityOnHand.toFixed(3).replace(/\.?0+$/, "")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{row.unit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
