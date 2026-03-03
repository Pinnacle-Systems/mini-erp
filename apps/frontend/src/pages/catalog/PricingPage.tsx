import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Switch } from "../../design-system/atoms/Switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../design-system/molecules/Card";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../../design-system/molecules/DenseTable";
import { DENSE_TABLE_COLUMN_WIDTHS } from "../../design-system/molecules/denseTableColumns";
import { ResettableInput } from "../../design-system/organisms/ResettableInput";
import { useSessionStore } from "../../features/auth/session-business";
import { useSyncActions } from "../../features/sync/SyncProvider";
import {
  getSyncRejectionFromError,
  getOutboxItemsByMutationIds,
  getLocalItemPricingRowsForDisplay,
  queueItemPriceUpsert,
  syncOnce,
  type ItemPricingRow,
} from "../../features/sync/engine";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

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
  const rejection = getSyncRejectionFromError(error);
  if (
    rejection?.reasonCode === "VERSION_CONFLICT" &&
    rejection.entity === "item_price"
  ) {
    return "You made an offline pricing update that was rejected because the server had a newer change.";
  }
  if (!(error instanceof Error)) return fallback;
  const message = error.message || "";
  return message || fallback;
};

export function PricingPage() {
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
  const debouncedQuery = useDebouncedValue(query, 250);
  const appliedQuery = (query.trim().length === 0 ? "" : debouncedQuery).trim();
  const { lastSyncCompletedAt } = useSyncActions();

  const refresh = useCallback(async (preserveDrafts = true) => {
    if (!activeStore) {
      setRows([]);
      setDraftsByVariantId({});
      return;
    }

    const nextRows = await getLocalItemPricingRowsForDisplay(activeStore, appliedQuery, includeInactive);
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
  }, [activeStore, appliedQuery, includeInactive]);

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

    void loadLocal();

    return () => {
      cancelled = true;
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
    if (!activeStore || lastSyncCompletedAt === null) return;

    void refresh(true).catch((nextError) => {
      console.error(nextError);
      setError("Unable to load pricing right now.");
    });
  }, [activeStore, lastSyncCompletedAt, refresh]);

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
        setError(
          toUserPricingErrorMessage(
            rejected[0]?.rejection ??
              new Error(
                rejected[0]?.error ??
                  "One or more price updates were rejected due to a conflict.",
              ),
          ),
        );
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
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <fieldset className="app-filter-panel lg:shrink-0">
            <legend className="app-filter-legend">Filters</legend>
            <p className="app-filter-help">Search by item, variant, SKU, or category.</p>
            <Label
              htmlFor="item-pricing-search"
              className="text-[11px] font-medium lg:text-[10px]"
            >
              Search pricing rows
            </Label>
            <div className="app-filter-row">
              <Input
                id="item-pricing-search"
                className={`${DENSE_INPUT_CLASS} w-full min-[642px]:flex-1 min-[642px]:min-w-[12rem]`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search item, variant, SKU, category"
              />
              <div className="inline-flex min-h-8 items-center gap-2.5">
                <Switch
                  id="include-inactive-priced-variants"
                  aria-label="Include inactive variants"
                  checked={includeInactive}
                  onCheckedChange={setIncludeInactive}
                  className="h-6 w-11 border border-[#b8cbe0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]"
                  checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                  uncheckedTrackClassName="border-[#b8cbe0] bg-[#dfe8f3]"
                />
                <Label htmlFor="include-inactive-priced-variants" className="shrink-0 leading-none">
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
                  <div key={row.variantId} className="rounded-xl border border-border/70 bg-white p-3 space-y-2">
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

          <DenseTable className="rounded-xl border-border/80">
            <DenseTableHead className="bg-slate-50/95">
              <tr>
                <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.item}>Item</DenseTableHeaderCell>
                <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.variant}>Variant</DenseTableHeaderCell>
                <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.sku}>SKU</DenseTableHeaderCell>
                <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.category}>Category</DenseTableHeaderCell>
                <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.status}>Status</DenseTableHeaderCell>
                <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.price}>Price</DenseTableHeaderCell>
                <DenseTableHeaderCell className={DENSE_TABLE_COLUMN_WIDTHS.unit}>Unit</DenseTableHeaderCell>
              </tr>
            </DenseTableHead>
            <DenseTableBody>
              {loading ? (
                <DenseTableRow>
                  <DenseTableCell className="py-3 text-muted-foreground" colSpan={7}>
                    Loading prices...
                  </DenseTableCell>
                </DenseTableRow>
              ) : rows.length === 0 ? (
                <DenseTableRow>
                  <DenseTableCell className="py-3 text-muted-foreground" colSpan={7}>
                    No variants found for current filters.
                  </DenseTableCell>
                </DenseTableRow>
              ) : (
                rows.map((row) => {
                  return (
                    <DenseTableRow key={row.variantId}>
                      <DenseTableCell className="truncate font-medium text-foreground" title={row.itemName}>
                        {row.itemName}
                      </DenseTableCell>
                      <DenseTableCell className="truncate text-muted-foreground" title={row.variantName}>
                        {row.variantName || "-"}
                      </DenseTableCell>
                      <DenseTableCell className="truncate font-mono text-[11px]" title={row.sku || "-"}>
                        {row.sku || "-"}
                      </DenseTableCell>
                      <DenseTableCell className="truncate" title={row.itemCategory || "-"}>
                        {row.itemCategory || "-"}
                      </DenseTableCell>
                      <DenseTableCell>
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
                      </DenseTableCell>
                      <DenseTableCell>
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
                      </DenseTableCell>
                      <DenseTableCell className="text-[11px] text-muted-foreground">{row.unit || "-"}</DenseTableCell>
                    </DenseTableRow>
                  );
                })
              )}
            </DenseTableBody>
          </DenseTable>

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
