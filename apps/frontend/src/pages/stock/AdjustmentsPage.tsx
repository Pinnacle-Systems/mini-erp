import { useEffect, useState } from "react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../design-system/molecules/Card";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../../design-system/molecules/DenseTable";
import { useSessionStore } from "../../features/auth/session-business";
import {
  getLocalStockVariantOptions,
  getSyncRejectionFromError,
  queueStockAdjustmentCreate,
  syncOnce,
  type StockAdjustmentReason,
  type StockVariantOption,
} from "../../features/sync/engine";

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
const DENSE_INPUT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";
const DENSE_SELECT_CLASS = "h-7 rounded-lg px-2 text-[11px] lg:text-[10px]";

type AdjustmentDraftRow = {
  id: string;
  variantId: string;
  reason: StockAdjustmentReason | "";
  quantity: string;
};

const buildEmptyRow = (variantId = ""): AdjustmentDraftRow => ({
  id: crypto.randomUUID(),
  variantId,
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
  row.variantId === "";

export function AdjustmentsPage() {
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [options, setOptions] = useState<StockVariantOption[]>([]);
  const [rows, setRows] = useState<AdjustmentDraftRow[]>(() => buildInitialRows());
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBusy = isLoadingOptions || isSubmitting;
  const optionByVariantId = new Map(options.map((option) => [option.variantId, option]));
  const readyRowCount = rows.filter((row) => {
    const parsedQuantity = Number(row.quantity.trim());
    return (
      row.variantId.length > 0 &&
      row.reason.length > 0 &&
      Number.isFinite(parsedQuantity) &&
      parsedQuantity > 0
    );
  }).length;

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

  const updateRow = (rowId: string, patch: Partial<AdjustmentDraftRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const addRow = () => {
    setRows((current) => [...current, buildEmptyRow()]);
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
      setError("Enter quantity in at least one adjustment row.");
      return;
    }

    for (const { row, index } of enteredRows) {
      if (!row.variantId) {
        setError(`Row ${index + 1}: Select an item variant.`);
        return;
      }
      if (!row.reason) {
        setError(`Row ${index + 1}: Select a movement type.`);
        return;
      }
      const parsedQuantity = Number(row.quantity.trim());
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        setError(`Row ${index + 1}: Quantity must be a positive number.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      for (const { row } of enteredRows) {
        await queueStockAdjustmentCreate(activeStore, identityId, {
          variantId: row.variantId,
          quantity: Number(row.quantity.trim()),
          reason: row.reason,
        });
      }
      await syncOnce(activeStore);

      const submittedRowIds = new Set(enteredRows.map(({ row }) => row.id));
      setRows((current) =>
        current.map((row) =>
          submittedRowIds.has(row.id)
            ? buildEmptyRow()
            : row,
        ),
      );
      setMessage(
        navigator.onLine
          ? enteredRows.length === 1
            ? "1 stock adjustment recorded."
            : `${enteredRows.length} stock adjustments recorded.`
          : enteredRows.length === 1
            ? "1 stock adjustment queued offline and will sync automatically."
            : `${enteredRows.length} stock adjustments queued offline and will sync automatically.`,
      );
    } catch (nextError) {
      console.error(nextError);
      setError(toUserStockErrorMessage(nextError));
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
              <CardDescription className="text-[11px] lg:text-[10px]">
                Record multiple stock movements quickly on desktop. Mobile keeps the flow focused
                to one stacked entry at a time.
              </CardDescription>
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
                      <Select
                        id={`stock-variant-${row.id}`}
                        value={row.variantId}
                        onChange={(event) => updateRow(row.id, { variantId: event.target.value })}
                        disabled={isBusy}
                      >
                        <option value="" disabled>
                          Select item variant
                        </option>
                        {options.map((option) => (
                          <option key={option.variantId} value={option.variantId}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
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
                        placeholder="e.g. 25"
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => clearRow(row.id)}
                        disabled={isBusy}
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => removeRow(row.id)}
                        disabled={isBusy}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <DenseTable className="lg:flex-1">
                <DenseTableHead>
                  <tr>
                    <DenseTableHeaderCell className="w-[46%]">Item Variant</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[20%]">Movement</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[14%]">Quantity</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[8%]">Unit</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[12%] text-right">Actions</DenseTableHeaderCell>
                  </tr>
                </DenseTableHead>
                <DenseTableBody>
                  {rows.map((row) => (
                    <DenseTableRow key={row.id}>
                      <DenseTableCell>
                        <Select
                          className={DENSE_SELECT_CLASS}
                          value={row.variantId}
                          onChange={(event) => updateRow(row.id, { variantId: event.target.value })}
                          disabled={isBusy}
                        >
                          <option value="" disabled>
                            Select item variant
                          </option>
                          {options.map((option) => (
                            <option key={option.variantId} value={option.variantId}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </DenseTableCell>
                      <DenseTableCell>
                        <Select
                          className={DENSE_SELECT_CLASS}
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
                      </DenseTableCell>
                      <DenseTableCell>
                        <Input
                          className={DENSE_INPUT_CLASS}
                          inputMode="decimal"
                          value={row.quantity}
                          onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                          placeholder="Qty"
                          disabled={isBusy}
                        />
                      </DenseTableCell>
                      <DenseTableCell>
                        <span className="text-[11px] text-muted-foreground">
                          {optionByVariantId.get(row.variantId)?.unit || "-"}
                        </span>
                      </DenseTableCell>
                      <DenseTableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => clearRow(row.id)}
                            disabled={isBusy}
                          >
                            Clear
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => removeRow(row.id)}
                            disabled={isBusy}
                          >
                            Remove
                          </Button>
                        </div>
                      </DenseTableCell>
                    </DenseTableRow>
                  ))}
                </DenseTableBody>
              </DenseTable>
            </>
          )}

          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
