import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../design-system/atoms/Button";
import { IconButton } from "../../design-system/atoms/IconButton";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import { Card, CardContent, CardHeader, CardTitle } from "../../design-system/molecules/Card";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
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
  spreadsheetCellControlClassName,
  spreadsheetCellNumericClassName,
  spreadsheetCellSelectClassName,
} from "../../design-system/molecules/spreadsheetStyles";
import { useSessionStore } from "../../features/auth/session-business";
import { hasAssignedStoreCapability } from "../../features/auth/session-business";
import {
  getLocalStockVariantOptions,
  getSyncRejectionFromError,
  queueStockAdjustmentCreate,
  syncOnce,
  type StockAdjustmentReason,
  type StockVariantOption,
} from "../../features/sync/engine";
import { useToast } from "../../features/toast/useToast";

const STOCK_REASON_OPTIONS: Array<{
  value: StockAdjustmentReason;
  label: string;
}> = [
  { value: "OPENING_BALANCE", label: "Opening Balance" },
  { value: "ADJUSTMENT_INCREASE", label: "Stock In" },
  { value: "ADJUSTMENT_DECREASE", label: "Stock Out" },
];

const DESKTOP_ROW_COUNT = 5;
const MOBILE_ROW_COUNT = 1;
type AdjustmentDraftRow = {
  id: string;
  variantId: string;
  variantQuery: string;
  reason: StockAdjustmentReason | "";
  quantity: string;
};

type ReadyAdjustmentDraftRow = AdjustmentDraftRow & {
  reason: StockAdjustmentReason;
};

const buildEmptyRow = (variantId = ""): AdjustmentDraftRow => ({
  id: crypto.randomUUID(),
  variantId,
  variantQuery: "",
  reason: "",
  quantity: "",
});

const getDefaultRowCount = () => {
  if (typeof window === "undefined") return DESKTOP_ROW_COUNT;
  return window.matchMedia("(min-width: 1024px)").matches
    ? DESKTOP_ROW_COUNT
    : MOBILE_ROW_COUNT;
};

const buildInitialRows = (count = getDefaultRowCount()) =>
  Array.from({ length: count }, () => buildEmptyRow());

const isDesktopViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

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
    return "Unable to record stock adjustments right now.";
  }
  return error.message || "Unable to record stock adjustments right now.";
};

const isRowPristine = (row: AdjustmentDraftRow) =>
  row.quantity.trim().length === 0 &&
  row.reason === "" &&
  row.variantId === "" &&
  row.variantQuery.trim().length === 0;

export function AdjustmentsPage() {
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const activeLocationId = useSessionStore((state) => state.activeLocationId);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const setActiveLocation = useSessionStore((state) => state.setActiveLocation);
  const { showToast } = useToast();
  const [options, setOptions] = useState<StockVariantOption[]>([]);
  const [rows, setRows] = useState<AdjustmentDraftRow[]>(() => buildInitialRows());
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFocusRowId, setPendingFocusRowId] = useState<string | null>(null);

  const isBusy = isLoadingOptions || isSubmitting;
  const optionByVariantId = new Map(options.map((option) => [option.variantId, option]));
  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;
  const resolvedLocationId = activeLocationId ?? activeBusiness?.defaultLocationId ?? null;
  const activeLocation =
    activeBusiness?.locations.find((location) => location.id === resolvedLocationId) ?? null;
  const canSelectLocation =
    activeBusiness !== null &&
    hasAssignedStoreCapability(activeBusiness, "BUSINESS_LOCATIONS") &&
    activeBusiness.locations.length > 1;
  const showAdjustmentToast = (
    tone: "success" | "error",
    description: string,
  ) => {
    showToast({
      title:
        tone === "success"
          ? "Stock adjustments recorded"
          : "Unable to record stock adjustments",
      description,
      tone,
      dedupeKey: `stock-adjustments:${tone}:${description}`,
    });
  };
  const readyRowCount = rows.filter((row) => {
    const parsedQuantity = Number(row.quantity.trim());
    return (
      row.variantId.length > 0 &&
      row.reason.length > 0 &&
      Number.isFinite(parsedQuantity) &&
      parsedQuantity > 0
    );
  }).length;
  const desktopGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,3fr) minmax(0,1.2fr) minmax(0,1.1fr) 3.5rem",
  );
  const getVariantLookupValue = (row: AdjustmentDraftRow) =>
    row.variantId && optionByVariantId.get(row.variantId)?.label
      ? (optionByVariantId.get(row.variantId)?.label ?? row.variantQuery)
      : row.variantQuery;

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");

    const syncDefaultRowCount = () => {
      setRows((current) => {
        const allPristine = current.every((row) => isRowPristine(row));
        if (!allPristine) return current;

        const nextCount = desktopMedia.matches ? DESKTOP_ROW_COUNT : MOBILE_ROW_COUNT;
        if (current.length === nextCount) return current;
        return buildInitialRows(nextCount);
      });
    };

    desktopMedia.addEventListener("change", syncDefaultRowCount);
    syncDefaultRowCount();

    return () => {
      desktopMedia.removeEventListener("change", syncDefaultRowCount);
    };
  }, []);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setOptions([]);
      setRows((current) =>
        current.map((row) => ({
          ...row,
          variantId: "",
        })),
      );
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoadingOptions(true);
      try {
        await syncOnce(activeStore);
        const nextOptions = await getLocalStockVariantOptions(activeStore);
        if (cancelled) return;

        setOptions(nextOptions);
        setRows((current) =>
          current.map((row) => ({
            ...row,
            variantId: nextOptions.some((option) => option.variantId === row.variantId)
              ? row.variantId
              : "",
            variantQuery: nextOptions.some((option) => option.variantId === row.variantId)
              ? (nextOptions.find((option) => option.variantId === row.variantId)?.label ??
                  row.variantQuery)
              : row.variantQuery,
          })),
        );
        setError(null);
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError(toUserStockErrorMessage(nextError));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeStore, isBusinessSelected]);

  useEffect(() => {
    if (!pendingFocusRowId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const targetId = isDesktopViewport()
        ? `stock-desktop-variant-${pendingFocusRowId}`
        : `stock-mobile-variant-${pendingFocusRowId}`;
      const target = document.getElementById(targetId);
      if (target instanceof HTMLElement) {
        target.focus();
        setPendingFocusRowId(null);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [pendingFocusRowId, rows]);

  const updateRow = (rowId: string, patch: Partial<AdjustmentDraftRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const addRow = () => {
    const nextRow = buildEmptyRow();
    setRows((current) => [...current, nextRow]);
    setPendingFocusRowId(nextRow.id);
  };

  const focusRowVariant = (rowId: string) => {
    const targetId = isDesktopViewport()
      ? `stock-desktop-variant-${rowId}`
      : `stock-mobile-variant-${rowId}`;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (target instanceof HTMLElement) {
        target.focus();
      }
    });
  };

  const moveToNextRowFromQuantity = (rowId: string) => {
    const currentIndex = rows.findIndex((row) => row.id === rowId);
    if (currentIndex < 0) {
      return;
    }

    const nextRow = rows[currentIndex + 1];
    if (nextRow) {
      focusRowVariant(nextRow.id);
      return;
    }

    const appendedRow = buildEmptyRow();
    setRows((current) => [...current, appendedRow]);
    setPendingFocusRowId(appendedRow.id);
  };

  const clearRow = (rowId: string) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? buildEmptyRow() : row,
      ),
    );
  };

  const removeRow = (rowId: string) => {
    setRows((current) => {
      if (current.length === 1) {
        return [buildEmptyRow()];
      }
      return current.filter((row) => row.id !== rowId);
    });
  };

  const onSubmit = async () => {
    if (
      !activeStore ||
      !identityId ||
      !isBusinessSelected ||
      isBusy ||
      options.length === 0
    ) {
      return;
    }

    const enteredRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.quantity.trim().length > 0);

    if (enteredRows.length === 0) {
      const nextError = "Enter quantity in at least one adjustment row.";
      setError(nextError);
      showAdjustmentToast("error", nextError);
      return;
    }
    if (!resolvedLocationId) {
      const nextError = "Select a business location before recording stock adjustments.";
      setError(nextError);
      showAdjustmentToast("error", nextError);
      return;
    }

    for (const { row, index } of enteredRows) {
      if (!row.variantId) {
        const nextError = `Row ${index + 1}: Select an item variant.`;
        setError(nextError);
        showAdjustmentToast("error", nextError);
        return;
      }
      if (!row.reason) {
        const nextError = `Row ${index + 1}: Select a movement type.`;
        setError(nextError);
        showAdjustmentToast("error", nextError);
        return;
      }
      const parsedQuantity = Number(row.quantity.trim());
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        const nextError = `Row ${index + 1}: Quantity must be a positive number.`;
        setError(nextError);
        showAdjustmentToast("error", nextError);
        return;
      }
    }

    const readyRows = enteredRows as Array<{ row: ReadyAdjustmentDraftRow; index: number }>;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      for (const { row } of readyRows) {
        await queueStockAdjustmentCreate(activeStore, identityId, {
          variantId: row.variantId,
          quantity: Number(row.quantity.trim()),
          reason: row.reason,
          locationId: resolvedLocationId,
        });
      }
      await syncOnce(activeStore);

      const submittedRowIds = new Set(readyRows.map(({ row }) => row.id));
      setRows((current) =>
        current.map((row) =>
          submittedRowIds.has(row.id)
            ? buildEmptyRow()
            : row,
        ),
      );
      const nextMessage =
        navigator.onLine
          ? readyRows.length === 1
            ? `1 stock adjustment recorded for ${activeLocation?.name ?? "the selected location"}.`
            : `${readyRows.length} stock adjustments recorded for ${activeLocation?.name ?? "the selected location"}.`
          : readyRows.length === 1
            ? `1 stock adjustment queued offline for ${activeLocation?.name ?? "the selected location"} and will sync automatically.`
            : `${readyRows.length} stock adjustments queued offline for ${activeLocation?.name ?? "the selected location"} and will sync automatically.`;
      setMessage(nextMessage);
      showAdjustmentToast("success", nextMessage);
    } catch (nextError) {
      console.error(nextError);
      const nextMessage = toUserStockErrorMessage(nextError);
      setError(nextMessage);
      showAdjustmentToast("error", nextMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="h-auto w-full lg:h-full lg:min-h-0">
      <Card className="h-auto w-full p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5 lg:shrink-0 lg:pb-1">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <CardTitle className="text-sm">Stock Adjustments</CardTitle>
              {activeBusiness ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground lg:text-[10px]">
                  <span className="font-medium text-foreground">Location:</span>
                  {canSelectLocation ? (
                    <Select
                      value={resolvedLocationId ?? ""}
                      disabled={isBusy}
                      onChange={(event) => {
                        if (!activeStore) {
                          return;
                        }
                        setActiveLocation(activeStore, event.target.value || null);
                      }}
                      className="h-7 min-w-[11rem] max-w-[14rem] bg-white px-2 text-[11px] lg:h-6 lg:text-[10px]"
                    >
                      {(activeBusiness.locations ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                          {location.isDefault ? " (Default)" : ""}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-foreground">
                      {activeLocation?.name ?? "Default location"}
                    </span>
                  )}
                  <span>Stock changes will be recorded here.</span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addRow}
                disabled={isBusy || options.length === 0}
              >
                Add Row
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void onSubmit();
                }}
                disabled={
                  !identityId ||
                  !activeStore ||
                  !isBusinessSelected ||
                  options.length === 0 ||
                  isBusy
                }
              >
                {isSubmitting ? "Saving..." : `Record Adjustments (${readyRowCount})`}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          {!activeStore || !isBusinessSelected ? (
            <p className="rounded-lg border border-border/80 bg-slate-50 px-2 py-2 text-xs text-muted-foreground">
              Select a business first to record stock adjustments.
            </p>
          ) : isLoadingOptions ? (
            <p className="rounded-lg border border-border/80 bg-slate-50 px-2 py-2 text-xs text-muted-foreground">
              Loading item variants...
            </p>
          ) : options.length === 0 ? (
            <p className="rounded-lg border border-border/80 bg-slate-50 px-2 py-2 text-xs text-muted-foreground">
              No synced item variants available. Add items first, then return here.
            </p>
          ) : (
            <>
              <div className="space-y-2 lg:hidden">
                {rows.map((row, index) => (
                  <div key={row.id} className="space-y-2 rounded-lg border border-border/80 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Row {index + 1}
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor={`stock-variant-${row.id}`}>Item Variant</Label>
                      <LookupDropdownInput
                        id={`stock-mobile-variant-${row.id}`}
                        value={getVariantLookupValue(row)}
                        disabled={isBusy}
                        onValueChange={(value) =>
                          updateRow(row.id, { variantId: "", variantQuery: value })
                        }
                        options={options}
                        placeholder="Search item variant"
                        onOptionSelect={(option) =>
                          updateRow(row.id, {
                            variantId: option.variantId,
                            variantQuery: option.label,
                          })
                        }
                        getOptionKey={(option) => option.variantId}
                        getOptionSearchText={(option) => `${option.label} ${option.unit}`}
                        renderOption={(option) => (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{option.label}</span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {option.unit}
                            </span>
                          </div>
                        )}
                        containerClassName="w-full"
                        inputProps={{ "aria-label": "Search item variant" }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`stock-reason-${row.id}`}>Movement Type</Label>
                      <Select
                        id={`stock-reason-${row.id}`}
                        value={row.reason}
                        onChange={(event) =>
                          updateRow(row.id, {
                            reason: event.target.value as StockAdjustmentReason | "",
                          })
                        }
                        disabled={isBusy}
                      >
                        <option value="" disabled>
                          Select movement type
                        </option>
                        {STOCK_REASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`stock-quantity-${row.id}`}>Quantity</Label>
                      <Input
                        id={`stock-quantity-${row.id}`}
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                        placeholder=""
                        disabled={isBusy}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Unit</Label>
                      <p className="min-h-8 rounded-lg border border-border/80 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                        {optionByVariantId.get(row.variantId)?.unit || "Select item variant first"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <IconButton
                        type="button"
                        variant="ghost"
                        className="flex-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                        icon={RotateCcw}
                        iconSize={14}
                        title="Clear row"
                        aria-label="Clear row"
                        onClick={() => clearRow(row.id)}
                        disabled={isBusy}
                      />
                      <IconButton
                        type="button"
                        variant="ghost"
                        className="flex-1 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                        icon={Trash2}
                        iconSize={14}
                        title="Remove row"
                        aria-label="Remove row"
                        onClick={() => removeRow(row.id)}
                        disabled={isBusy}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-1 hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden bg-white">
                  <TabularHeader>
                    <TabularRow columns={desktopGridTemplate}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Item Variant</TabularCell>
                      <TabularCell variant="header">Movement</TabularCell>
                      <TabularCell variant="header" align="end">
                        Quantity
                      </TabularCell>
                      <TabularCell variant="header" align="center">
                        Actions
                      </TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {rows.map((row, index) => (
                      <TabularRow key={row.id} columns={desktopGridTemplate} interactive>
                        <TabularSerialNumberCell index={index} />
                        <TabularCell variant="editable">
                          <LookupDropdownInput
                            id={`stock-desktop-variant-${row.id}`}
                            value={getVariantLookupValue(row)}
                            disabled={isBusy}
                            containerClassName="h-full w-full"
                            inputUnstyled
                            inputClassName={cn(
                              spreadsheetCellSelectClassName,
                              row.variantId ? "text-foreground" : "text-[#8ea0b3]",
                            )}
                            dropdownClassName="max-h-56"
                            onValueChange={(value) =>
                              updateRow(row.id, { variantId: "", variantQuery: value })
                            }
                            options={options}
                            placeholder="Search item variant"
                            onOptionSelect={(option) =>
                              updateRow(row.id, {
                                variantId: option.variantId,
                                variantQuery: option.label,
                              })
                            }
                            getOptionKey={(option) => option.variantId}
                            getOptionSearchText={(option) => `${option.label} ${option.unit}`}
                            renderOption={(option) => (
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{option.label}</span>
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {option.unit}
                                </span>
                              </div>
                            )}
                            inputProps={{ "aria-label": "Search item variant" }}
                          />
                        </TabularCell>
                        <TabularCell variant="editable">
                          <Select
                            id={`stock-desktop-reason-${row.id}`}
                            unstyled
                            className={cn(
                              spreadsheetCellSelectClassName,
                              row.reason ? "text-foreground" : "text-[#8ea0b3]",
                            )}
                            value={row.reason}
                            onChange={(event) =>
                              updateRow(row.id, {
                                reason: event.target.value as StockAdjustmentReason | "",
                              })
                            }
                            disabled={isBusy}
                          >
                            <option value="" disabled>
                              Select movement type
                            </option>
                            {STOCK_REASON_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </TabularCell>
                        <TabularCell variant="editable" align="end">
                          <div className="relative flex h-full w-full items-center pr-11">
                            <Input
                              id={`stock-desktop-quantity-${row.id}`}
                              unstyled
                              className={`${spreadsheetCellControlClassName} ${spreadsheetCellNumericClassName} w-full px-0 pr-0`}
                              inputMode="decimal"
                              value={row.quantity}
                              onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                              placeholder=""
                              disabled={isBusy}
                              onKeyDown={(event) => {
                                if (event.key === "Tab" && !event.shiftKey) {
                                  event.preventDefault();
                                  moveToNextRowFromQuantity(row.id);
                                }
                              }}
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                              {row.variantId && optionByVariantId.get(row.variantId)?.unit
                                ? optionByVariantId.get(row.variantId)?.unit
                                : ""}
                            </span>
                          </div>
                        </TabularCell>
                        <TabularCell align="center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <IconButton
                              type="button"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                              icon={RotateCcw}
                              iconSize={14}
                              title="Clear row"
                              aria-label="Clear row"
                              onClick={() => clearRow(row.id)}
                              disabled={isBusy}
                            />
                            <IconButton
                              type="button"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                              icon={Trash2}
                              iconSize={14}
                              title="Remove row"
                              aria-label="Remove row"
                              onClick={() => removeRow(row.id)}
                              disabled={isBusy}
                            />
                          </div>
                        </TabularCell>
                      </TabularRow>
                    ))}
                  </TabularBody>
                </TabularSurface>
              </div>
            </>
          )}

          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
