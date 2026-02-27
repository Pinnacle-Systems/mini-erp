import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Label } from "../design-system/atoms/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";
import { ResettableInput } from "../design-system/organisms/ResettableInput";
import { useSessionStore } from "../features/auth/session-business";
import {
  getOutboxItemsByMutationIds,
  getLocalItemPricingRowsForDisplay,
  queueItemPriceUpsert,
  syncOnce,
  type ItemPricingRow,
} from "../features/sync/engine";

const DENSE_INPUT_CLASS = "h-8 rounded-xl px-3 text-xs";

const formatAmount = (amount: number | null) => {
  if (amount === null || Number.isNaN(amount)) return "";
  return amount.toFixed(2);
};

const normalizePriceDraft = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return "";
  return parsed.toFixed(2);
};

const toUserPricingErrorMessage = (error: unknown) => {
  const fallback = "Unable to sync pricing right now.";
  if (!(error instanceof Error)) return fallback;
  const message = error.message || "";
  if (message.includes("Version conflict for item_price")) {
    return "You made an offline pricing update that was rejected because the server had a newer change.";
  }
  return message || fallback;
};

export function CatalogPricingPage() {
  const identityId = useSessionStore((state) => state.identityId);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const activeStore = useSessionStore((state) => state.activeStore);
  const [rows, setRows] = useState<ItemPricingRow[]>([]);
  const [draftsByVariantId, setDraftsByVariantId] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncedStoreRef = useRef<string | null>(null);

  const refresh = useCallback(async (preserveDrafts = true) => {
    if (!activeStore) {
      setRows([]);
      setDraftsByVariantId({});
      return;
    }

    const nextRows = await getLocalItemPricingRowsForDisplay(activeStore, query, includeInactive);
    setRows(nextRows);
    setDraftsByVariantId((current) => {
      const defaults = Object.fromEntries(
        nextRows.map((row) => [row.variantId, formatAmount(row.amount)]),
      );
      if (!preserveDrafts) {
        return defaults;
      }
      return {
        ...defaults,
        ...Object.fromEntries(
          Object.entries(current).filter(([variantId]) =>
            nextRows.some((row) => row.variantId === variantId),
          ),
        ),
      };
    });
  }, [activeStore, includeInactive, query]);

  useEffect(() => {
    if (!activeStore) {
      setRows([]);
      setDraftsByVariantId({});
      syncedStoreRef.current = null;
      return;
    }

    let cancelled = false;

    const loadLocal = async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError("Unable to load pricing right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void loadLocal();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeStore, refresh]);

  useEffect(() => {
    if (!activeStore) return;
    if (syncedStoreRef.current === activeStore) return;
    syncedStoreRef.current = activeStore;

    let cancelled = false;
    const syncForStore = async () => {
      setLoading(true);
      setError(null);
      try {
        await syncOnce(activeStore);
        if (cancelled) return;
        await refresh(false);
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError(toUserPricingErrorMessage(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void syncForStore();

    return () => {
      cancelled = true;
    };
  }, [activeStore, refresh]);

  useEffect(() => {
    if (!activeStore) return;

    const onOnline = () => {
      setLoading(true);
      setError(null);
      void syncOnce(activeStore)
        .then(async () => {
          await refresh(false);
        })
        .catch((nextError) => {
          console.error(nextError);
          setError(toUserPricingErrorMessage(nextError));
        })
        .finally(() => {
          setLoading(false);
        });
    };

    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [activeStore, refresh]);

  const queuePriceChange = async (variantId: string, amount: number | null) => {
    if (!activeStore || !identityId || !isBusinessSelected) return;

    const variant = rows.find((row) => row.variantId === variantId);
    const currency = variant?.currency || "INR";
    const mutationId = await queueItemPriceUpsert(
      activeStore,
      identityId,
      variantId,
      amount,
      currency,
      variant?.serverVersion ?? 0,
    );
    setRows((current) =>
      current.map((row) =>
        row.variantId === variantId
          ? {
              ...row,
              amount,
              currency,
              pending: true,
            }
          : row,
      ),
    );
    return mutationId;
  };

  const toParsedAmount = (variantId: string) => {
    const raw = draftsByVariantId[variantId] ?? "";
    const normalized = raw.trim();
    if (!normalized) {
      return { amount: null, error: null };
    }

    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount < 0) {
      return { amount: null, error: "Price must be a valid non-negative number." };
    }
    return { amount, error: null };
  };

  const dirtyVariantIds = rows.filter((row) => {
    const parsed = toParsedAmount(row.variantId);
    if (parsed.error) return false;
    return parsed.amount !== row.amount;
  }).map((row) => row.variantId);

  const onSaveAll = async () => {
    if (!activeStore || !identityId || !isBusinessSelected) return;
    if (dirtyVariantIds.length === 0) return;

    for (const variantId of dirtyVariantIds) {
      const parsed = toParsedAmount(variantId);
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
    }

    setIsSavingAll(true);
    setError(null);
    try {
      const mutationIds: string[] = [];
      for (const variantId of dirtyVariantIds) {
        const parsed = toParsedAmount(variantId);
        const mutationId = await queuePriceChange(variantId, parsed.amount);
        if (mutationId) {
          mutationIds.push(mutationId);
        }
      }
      await syncOnce(activeStore);
      const queuedMutations = await getOutboxItemsByMutationIds(mutationIds);
      const rejected = queuedMutations.filter((entry) => entry.status === "rejected");
      if (rejected.length > 0) {
        const reason = rejected[0]?.error || "One or more price updates were rejected due to a conflict.";
        setError(toUserPricingErrorMessage(new Error(reason)));
      }
      await refresh(false);
    } catch (nextError) {
      console.error(nextError);
      setError(toUserPricingErrorMessage(nextError));
    } finally {
      setIsSavingAll(false);
    }
  };

  const onDiscardAll = () => {
    setDraftsByVariantId(
      Object.fromEntries(rows.map((row) => [row.variantId, formatAmount(row.amount)])),
    );
    setError(null);
  };

  const onPriceDraftChange = (variantId: string, raw: string) => {
    setDraftsByVariantId((current) => ({
      ...current,
      [variantId]: raw,
    }));
  };

  const onPriceDraftBlur = (variantId: string) => {
    setDraftsByVariantId((current) => ({
      ...current,
      [variantId]: normalizePriceDraft(current[variantId] ?? ""),
    }));
  };

  return (
    <section className="h-auto w-full lg:h-full lg:min-h-0">
      <Card className="h-auto w-full p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5 lg:shrink-0 lg:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <CardTitle className="text-sm">Pricing</CardTitle>
              <CardDescription className="text-[11px] lg:text-[10px]">
                Maintain base selling prices per variant.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!activeStore) return;
                setLoading(true);
                setError(null);
                try {
                  await syncOnce(activeStore);
                  await refresh(false);
                } catch (nextError) {
                  console.error(nextError);
                  setError(toUserPricingErrorMessage(nextError));
                } finally {
                  setLoading(false);
                }
              }}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <fieldset className="app-filter-panel lg:shrink-0">
            <legend className="app-filter-legend">Filters</legend>
            <p className="app-filter-help">Search by item, variant, SKU, or category.</p>
            <div className="app-filter-row">
              <Input
                id="item-pricing-search"
                className={`${DENSE_INPUT_CLASS} w-full min-[642px]:flex-1 min-[642px]:min-w-[12rem]`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search item, variant, SKU, category"
              />
              <div className="inline-flex items-center gap-2">
                <button
                  id="include-inactive-priced-variants"
                  type="button"
                  role="switch"
                  aria-checked={includeInactive}
                  aria-label="Include inactive variants"
                  onClick={() => setIncludeInactive((current) => !current)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/35 ${
                    includeInactive
                      ? "border-[#2f6fb7] bg-[#4a8dd9]"
                      : "border-[#b8cbe0] bg-[#e7eff8]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
                      includeInactive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <Label htmlFor="include-inactive-priced-variants" className="shrink-0">
                  Include inactive
                </Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full min-[642px]:w-auto"
                onClick={() => {
                  setQuery("");
                  setIncludeInactive(false);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </fieldset>

          {error ? <div className="card text-sm text-red-600">{error}</div> : null}

          <div className="space-y-2 lg:hidden">
            {loading ? (
              <div className="card text-sm text-muted-foreground">Loading prices...</div>
            ) : rows.length === 0 ? (
              <div className="card text-sm text-muted-foreground">No variants found for current filters.</div>
            ) : (
              rows.map((row) => {
                return (
                  <div key={row.variantId} className="rounded-2xl border border-border/70 bg-white/90 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{row.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.variantName || "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          SKU: <span className="font-mono">{row.sku || "-"}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">Category: {row.itemCategory || "-"}</p>
                      </div>
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <ResettableInput
                        value={draftsByVariantId[row.variantId] ?? ""}
                        defaultValue={formatAmount(row.amount)}
                        onValueChange={(next) => onPriceDraftChange(row.variantId, next)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void onSaveAll();
                          }
                        }}
                        onBlur={() => onPriceDraftBlur(row.variantId)}
                        className={`${DENSE_INPUT_CLASS} w-full`}
                        placeholder="0.00"
                        disabled={isSavingAll}
                        resetAriaLabel={`Reset price for ${row.itemName}`}
                      />
                      <span className="text-[11px] text-muted-foreground">/ {row.unit || "-"}</span>
                    </div>

                  </div>
                );
              })
            )}
          </div>

          <div className="hidden rounded-2xl border border-border/70 bg-white/80 lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <table className="w-full table-fixed text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-slate-50/95 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-32 px-2 py-2 font-semibold">Item</th>
                  <th className="w-24 px-2 py-2 font-semibold">Variant</th>
                  <th className="w-20 px-2 py-2 font-semibold">SKU</th>
                  <th className="w-20 px-2 py-2 font-semibold">Category</th>
                  <th className="w-20 px-2 py-2 font-semibold">Status</th>
                  <th className="w-32 px-2 py-2 font-semibold">Price</th>
                  <th className="w-16 px-2 py-2 font-semibold">Unit</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-2 py-3 text-muted-foreground" colSpan={7}>
                      Loading prices...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-3 text-muted-foreground" colSpan={7}>
                      No variants found for current filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    return (
                      <tr key={row.variantId} className="border-t border-border/60 align-middle">
                        <td className="truncate px-2 py-2 align-middle font-medium text-foreground" title={row.itemName}>
                          {row.itemName}
                        </td>
                        <td className="truncate px-2 py-2 align-middle text-muted-foreground" title={row.variantName}>
                          {row.variantName || "-"}
                        </td>
                        <td className="truncate px-2 py-2 align-middle font-mono text-[11px]" title={row.sku || "-"}>
                          {row.sku || "-"}
                        </td>
                        <td className="truncate px-2 py-2 align-middle" title={row.itemCategory || "-"}>
                          {row.itemCategory || "-"}
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <div className="inline-flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                row.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {row.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <div className="flex items-center gap-1">
                            <ResettableInput
                              value={draftsByVariantId[row.variantId] ?? ""}
                              defaultValue={formatAmount(row.amount)}
                              onValueChange={(next) => onPriceDraftChange(row.variantId, next)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void onSaveAll();
                                }
                              }}
                              onBlur={() => onPriceDraftBlur(row.variantId)}
                              className={`${DENSE_INPUT_CLASS} w-12`}
                              placeholder="0.00"
                              disabled={isSavingAll}
                              resetAriaLabel={`Reset price for ${row.itemName}`}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle text-[11px] text-muted-foreground">{row.unit || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Showing {rows.length} variants.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDiscardAll}
              disabled={isSavingAll || dirtyVariantIds.length === 0}
            >
              Discard All
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void onSaveAll();
              }}
              disabled={isSavingAll || dirtyVariantIds.length === 0}
            >
              {isSavingAll ? "Saving..." : `Save All (${dirtyVariantIds.length})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
