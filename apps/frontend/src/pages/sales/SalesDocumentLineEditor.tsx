import { useRef, type ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
import { GstSlabSelect } from "../../design-system/molecules/GstSlabSelect";
import {
  spreadsheetCellControlClassName,
  spreadsheetCellNumericClassName,
  spreadsheetCellSelectClassName,
} from "../../design-system/molecules/spreadsheetStyles";
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
import { tabularNumericClassName } from "../../design-system/molecules/tabularTokens";
import { useSpreadsheetNavigation } from "../../design-system/molecules/useSpreadsheetNavigation";
import { normalizeGstSlab } from "../../lib/gst-slabs";
import { cn } from "../../lib/utils";
import { SalesItemOptionContent } from "./SalesItemOptionContent";
import {
  formatCurrency,
  getLineTotals,
  getSalesLineDescriptionInputId,
  toTaxRateNumber,
  type BillLine,
  type SalesDocumentPageConfig,
  type SalesItemOption,
  type SalesLineFieldKey,
} from "./useSalesDocumentWorkspace";

type SalesDocumentLineEditorProps = {
  config: SalesDocumentPageConfig;
  lines: BillLine[];
  itemOptions: SalesItemOption[];
  lookupLoading: boolean;
  isViewingPostedDocument: boolean;
  isPosMode: boolean;
  shouldShowOriginBadges: boolean;
  activeLineId?: string | null;
  lineHeaderSlot?: ReactNode;
  onActiveLineChange?: (lineId: string) => void;
  onAppendLine: () => void;
  onApplyLineItem: (lineId: string, option: SalesItemOption) => void;
  onUpdateLine: (
    lineId: string,
    field: SalesLineFieldKey,
    value: string,
  ) => void;
  onRemoveLine: (lineId: string) => void;
  getLinkedLineCap: (line: BillLine) => number | null;
  getLineOriginTitle: (line: BillLine) => string | null;
  getOriginBadgeClassName: (line: BillLine) => string;
  getSameItemMixedOriginHint: (line: BillLine) => string | null;
};

const hasEditableLineContent = (line: BillLine) =>
  Boolean(
    line.description.trim() ||
      line.unitPrice.trim() ||
      line.variantId.trim() ||
      (line.quantity.trim() &&
        line.quantity.trim() !== "0" &&
        line.quantity.trim() !== "1"),
  );

export function SalesDocumentLineEditor({
  config,
  lines,
  itemOptions,
  lookupLoading,
  isViewingPostedDocument,
  isPosMode,
  shouldShowOriginBadges,
  activeLineId,
  lineHeaderSlot,
  onActiveLineChange,
  onAppendLine,
  onApplyLineItem,
  onUpdateLine,
  onRemoveLine,
  getLinkedLineCap,
  getLineOriginTitle,
  getOriginBadgeClassName,
  getSameItemMixedOriginHint,
}: SalesDocumentLineEditorProps) {
  const desktopTableRef = useRef<HTMLDivElement | null>(null);
  const hasStartedSale = lines.some(
    (line) =>
      line.variantId.trim().length > 0 ||
      line.description.trim().length > 0 ||
      line.unitPrice.trim().length > 0,
  );
  const getLineFieldOrder = (lineId: string): SalesLineFieldKey[] => {
    if (isViewingPostedDocument) {
      return [];
    }

    const line = lines.find((entry) => entry.id === lineId);
    if (!line) {
      return [];
    }

    const fields: SalesLineFieldKey[] = [];
    if (!line.sourceLineId) {
      fields.push("description");
    }
    fields.push("quantity", "unitPrice", "taxRate");
    if (!isPosMode) {
      fields.push("taxMode");
    }
    return fields;
  };
  const desktopGridTemplate = withTabularSerialNumberColumn(
    [
      isPosMode ? "minmax(0, 3.4fr)" : "minmax(0, 2.8fr)",
      "minmax(4.25rem, 1fr)",
      "minmax(4.5rem, 1fr)",
      "minmax(5rem, 1.2fr)",
      ...(!isPosMode ? ["minmax(3.75rem, 0.8fr)"] : []),
      "minmax(4.5rem, 0.95fr)",
      "minmax(5rem, 1fr)",
      ...(!isViewingPostedDocument ? [isPosMode ? "2.75rem" : "2.25rem"] : []),
    ].join(" "),
  );
  const {
    getCellDataAttributes,
    handleCellFocus,
    handleCellKeyDown,
  } = useSpreadsheetNavigation<SalesLineFieldKey>({
    containerRef: desktopTableRef,
    getRowOrder: () => lines.map((line) => line.id),
    getFieldOrderForRow: getLineFieldOrder,
    appendMode: "grow-as-needed",
    canAppendFromRow: (lineId) => {
      if (isPosMode) {
        return false;
      }

      const line = lines.find((entry) => entry.id === lineId);
      return Boolean(line && hasEditableLineContent(line));
    },
    onRequestAppendRow: () => {
      onAppendLine();
    },
  });

  return (
    <div className="flex min-h-[14rem] flex-1 flex-col gap-1.5 pt-1 md:min-h-0 md:overflow-hidden">
      <div className={`flex flex-col md:shrink-0 ${isPosMode ? "gap-1" : "gap-1.5"}`}>
        <div
          className={`flex items-center justify-between ${
            isPosMode ? "md:hidden" : ""
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} Lines`}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isViewingPostedDocument}
            onClick={onAppendLine}
          >
            Add Line
          </Button>
        </div>
        {lineHeaderSlot}
      </div>

      <div className="space-y-2 md:hidden">
        {isPosMode && !hasStartedSale ? (
          <div className="rounded-xl border border-dashed border-[#b9cfe7] bg-[#f8fbff] px-4 py-8 text-center">
            <div className="text-sm font-semibold text-foreground">
              Scan barcode or search item to start sale
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              The register is ready for the next item. Blank rows remain visible below.
            </div>
          </div>
        ) : null}
        {lines.map((line, index) => {
          const lineTotals = getLineTotals(line);
          const isPosStarterLine =
            isPosMode &&
            !hasStartedSale &&
            index === 0 &&
            !line.sourceLineId &&
            line.variantId.trim().length === 0 &&
            line.description.trim().length === 0 &&
            line.unitPrice.trim().length === 0;
          return (
            <div
              key={line.id}
              data-bill-line-id={line.id}
              className={`rounded-lg border p-2 ${
                isPosMode && activeLineId === line.id
                  ? "border-[#8fb6e2] bg-[#edf5ff]"
                  : "border-border/80 bg-slate-50"
              }`}
              onClick={() => onActiveLineChange?.(line.id)}
              onFocusCapture={() => onActiveLineChange?.(line.id)}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-foreground">
                  Line {index + 1}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onRemoveLine(line.id)}
                  disabled={isViewingPostedDocument}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
              <div className="grid gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`sales-line-mobile-description-${line.id}`}>
                    Item
                  </Label>
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      {isPosStarterLine ? (
                        <div className="flex h-8 items-center rounded-lg border border-dashed border-[#b9cfe7] bg-[#f8fbff] px-3 text-[11px] text-muted-foreground">
                          Use Quick add item above to start the sale.
                        </div>
                      ) : (
                        <LookupDropdownInput
                          id={`sales-line-mobile-description-${line.id}`}
                          value={line.description}
                          disabled={isViewingPostedDocument || Boolean(line.sourceLineId)}
                          onValueChange={(value) =>
                            onUpdateLine(line.id, "description", value)
                          }
                          options={itemOptions}
                          loading={lookupLoading}
                          loadingLabel="Loading items"
                          placeholder="Search item or service"
                          onOptionSelect={(option) => onApplyLineItem(line.id, option)}
                          getOptionKey={(option) => option.variantId}
                          getOptionSearchText={(option) =>
                            `${option.label} ${option.sku} ${option.gstLabel}`
                          }
                          renderOption={(option) => (
                            <SalesItemOptionContent option={option} />
                          )}
                        />
                      )}
                    </div>
                    {shouldShowOriginBadges && line.sourceLineId ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${getOriginBadgeClassName(line)} cursor-help`}
                        title={getLineOriginTitle(line) ?? undefined}
                      >
                        Linked
                      </span>
                    ) : null}
                    {getSameItemMixedOriginHint(line) ? (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full bg-amber-500 p-1 text-white"
                        title={getSameItemMixedOriginHint(line) ?? undefined}
                        aria-label={getSameItemMixedOriginHint(line) ?? undefined}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`sales-line-mobile-qty-${line.id}`}>Qty</Label>
                    <Input
                      id={`sales-line-mobile-qty-${line.id}`}
                      className="text-right tabular-nums"
                      value={line.quantity}
                      max={getLinkedLineCap(line) ?? undefined}
                      readOnly={isViewingPostedDocument}
                      disabled={isViewingPostedDocument}
                      onChange={(event) =>
                        onUpdateLine(line.id, "quantity", event.target.value)
                      }
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`sales-line-mobile-rate-${line.id}`}>Rate</Label>
                    <Input
                      id={`sales-line-mobile-rate-${line.id}`}
                      className="text-right tabular-nums"
                      value={line.unitPrice}
                      readOnly={isViewingPostedDocument}
                      disabled={isViewingPostedDocument}
                      onChange={(event) =>
                        onUpdateLine(line.id, "unitPrice", event.target.value)
                      }
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>GST %</Label>
                    <GstSlabSelect
                      id={`sales-line-mobile-tax-${line.id}`}
                      className="h-[38px] text-xs text-left"
                      value={normalizeGstSlab(line.taxRate) || ""}
                      disabled={isViewingPostedDocument}
                      onChange={(e) =>
                        onUpdateLine(line.id, "taxRate", e.target.value)
                      }
                      placeholderOption="GST %"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center rounded-md border border-border/70 bg-white px-2 py-1.5">
                    <span className="mr-1">Unit:</span>
                    <span className="font-medium text-foreground">
                      {line.unit || "PCS"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto w-full justify-between border-border/70 bg-white px-2 py-1.5 text-[11px] font-normal text-muted-foreground"
                    disabled={isViewingPostedDocument}
                    onClick={() =>
                      onUpdateLine(
                        line.id,
                        "taxMode",
                        line.taxMode === "INCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE",
                      )
                    }
                  >
                    Tax mode:
                    <span className="font-medium text-foreground">
                      {line.taxMode === "INCLUSIVE" ? "Inclusive" : "Exclusive"}
                    </span>
                  </Button>
                  <div className="col-span-2 space-y-0.5 rounded-md border border-border/70 bg-white px-2 py-1.5">
                    {toTaxRateNumber(line.taxRate) > 0 ? (
                      line.taxMode === "INCLUSIVE" ? (
                        <>
                          <div className="flex justify-between">
                            <span>Base (excl. GST)</span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(lineTotals.subTotal)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>GST ({line.taxRate})</span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(lineTotals.taxTotal)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span>Base</span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(lineTotals.subTotal)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>+GST ({line.taxRate})</span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(lineTotals.taxTotal)}
                            </span>
                          </div>
                        </>
                      )
                    ) : null}
                    <div className="flex justify-between border-t border-border/50 pt-0.5">
                      <span className="font-semibold text-foreground">
                        Line total
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(lineTotals.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden min-h-0 flex-1 overflow-hidden md:flex md:flex-col">
        <div className={`flex min-h-0 flex-1 flex-col ${isPosMode ? "gap-1" : "gap-2"}`}>
          <TabularSurface
            ref={desktopTableRef}
            role="grid"
            aria-label={`${config.singularLabel} lines`}
            className="hidden min-h-0 flex-1 overflow-hidden bg-white md:flex"
          >
            <TabularHeader>
              <TabularRow columns={desktopGridTemplate}>
                <TabularSerialNumberHeaderCell />
                <TabularCell variant="header">Item</TabularCell>
                <TabularCell variant="header" align="end">Qty</TabularCell>
                <TabularCell variant="header" align="end">Rate</TabularCell>
                <TabularCell variant="header">GST %</TabularCell>
                {!isPosMode ? (
                  <TabularCell variant="header">Mode</TabularCell>
                ) : null}
                <TabularCell variant="header" align="end">Tax</TabularCell>
                <TabularCell variant="header" align="end">Total</TabularCell>
                {!isViewingPostedDocument ? (
                  <TabularCell variant="header" align="center" />
                ) : null}
              </TabularRow>
            </TabularHeader>
            <TabularBody>
              {lines.map((line, index) => {
                const lineTotals = getLineTotals(line);
                return (
                  <TabularRow
                    key={line.id}
                    columns={desktopGridTemplate}
                    interactive
                    data-bill-line-id={line.id}
                    className={
                      isPosMode && activeLineId === line.id
                        ? "[&>div]:!bg-[#edf5ff] shadow-[inset_3px_0_0_0_#4a8dd9]"
                        : undefined
                    }
                    onClick={() => onActiveLineChange?.(line.id)}
                    onFocusCapture={() => onActiveLineChange?.(line.id)}
                  >
                    <TabularSerialNumberCell index={index} />
                    <TabularCell variant="editable">
                      <div className="relative min-w-0 flex-1">
                        <LookupDropdownInput
                          id={getSalesLineDescriptionInputId(line.id)}
                          value={line.description}
                          disabled={isViewingPostedDocument || Boolean(line.sourceLineId)}
                          onValueChange={(value) =>
                            onUpdateLine(line.id, "description", value)
                          }
                          options={itemOptions}
                          loading={lookupLoading}
                          loadingLabel="Loading items"
                          placeholder="Search item or service"
                          onOptionSelect={(option) => onApplyLineItem(line.id, option)}
                          getOptionKey={(option) => option.variantId}
                          getOptionSearchText={(option) =>
                            `${option.label} ${option.sku} ${option.gstLabel}`
                          }
                          renderOption={(option) => (
                            <SalesItemOptionContent option={option} />
                          )}
                          inputClassName={cn(
                            spreadsheetCellControlClassName,
                            isPosMode ? "pr-8 lg:pr-10" : "pr-10 lg:pr-12",
                          )}
                          inputUnstyled
                          inputProps={{
                            ...getCellDataAttributes(line.id, "description"),
                            onKeyDown: (event) =>
                              handleCellKeyDown(event, line.id, "description"),
                            onFocus: () => handleCellFocus(line.id, "description"),
                          }}
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
                          {shouldShowOriginBadges && line.sourceLineId ? (
                            <span
                              className={`pointer-events-auto inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getOriginBadgeClassName(line)} cursor-help`}
                              title={getLineOriginTitle(line) ?? undefined}
                            >
                              Linked
                            </span>
                          ) : null}
                          {getSameItemMixedOriginHint(line) ? (
                            <span
                              className="pointer-events-auto inline-flex shrink-0 items-center rounded-full bg-amber-500 p-0.5 text-white"
                              title={getSameItemMixedOriginHint(line) ?? undefined}
                              aria-label={getSameItemMixedOriginHint(line) ?? undefined}
                            >
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TabularCell>
                    <TabularCell variant="editable" align="end">
                      <div className="relative w-full">
                        <Input
                          unstyled
                          {...getCellDataAttributes(line.id, "quantity")}
                          data-sales-line-cell={`${line.id}:quantity`}
                          className={cn(
                            spreadsheetCellControlClassName,
                            spreadsheetCellNumericClassName,
                            "w-full min-w-0 px-1 pr-7 lg:pr-8",
                          )}
                          value={line.quantity}
                          max={getLinkedLineCap(line) ?? undefined}
                          readOnly={isViewingPostedDocument}
                          disabled={isViewingPostedDocument}
                          onChange={(event) =>
                            onUpdateLine(line.id, "quantity", event.target.value)
                          }
                          onFocus={() => handleCellFocus(line.id, "quantity")}
                          onKeyDown={(event) => handleCellKeyDown(event, line.id, "quantity")}
                          inputMode="decimal"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center whitespace-nowrap text-[9px] leading-none text-muted-foreground lg:right-2 lg:text-[10px]">
                          {line.unit || "PCS"}
                        </span>
                      </div>
                    </TabularCell>
                    <TabularCell variant="editable" align="end">
                      <Input
                        unstyled
                        {...getCellDataAttributes(line.id, "unitPrice")}
                        data-sales-line-cell={`${line.id}:unitPrice`}
                        className={cn(
                          spreadsheetCellControlClassName,
                          spreadsheetCellNumericClassName,
                          tabularNumericClassName,
                          "min-w-0 px-1.5 lg:px-2",
                        )}
                        value={line.unitPrice}
                        readOnly={isViewingPostedDocument}
                        disabled={isViewingPostedDocument}
                        onChange={(event) =>
                          onUpdateLine(line.id, "unitPrice", event.target.value)
                        }
                        onFocus={() => handleCellFocus(line.id, "unitPrice")}
                        onKeyDown={(event) => handleCellKeyDown(event, line.id, "unitPrice")}
                        inputMode="decimal"
                      />
                    </TabularCell>
                    <TabularCell variant="editable">
                      <GstSlabSelect
                        unstyled
                        {...getCellDataAttributes(line.id, "taxRate")}
                        data-sales-line-cell={`${line.id}:taxRate`}
                        className={cn(
                          spreadsheetCellSelectClassName,
                          "min-w-0 px-1 text-left text-[11px] lg:px-2 lg:text-xs",
                        )}
                        value={normalizeGstSlab(line.taxRate) || ""}
                        disabled={isViewingPostedDocument}
                        onChange={(e) =>
                          onUpdateLine(line.id, "taxRate", e.target.value)
                        }
                        onFocus={() => handleCellFocus(line.id, "taxRate")}
                        onKeyDown={(event) => handleCellKeyDown(event, line.id, "taxRate")}
                        placeholderOption="GST %"
                      />
                    </TabularCell>
                    {!isPosMode ? (
                      <TabularCell variant="editable">
                        <Button
                          {...getCellDataAttributes(line.id, "taxMode")}
                          data-sales-line-cell={`${line.id}:taxMode`}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-[var(--tabular-row-height)] w-full min-w-0 rounded-none border-none bg-transparent px-0 text-[11px] text-muted-foreground shadow-none hover:bg-slate-50 lg:text-[10px]"
                          disabled={isViewingPostedDocument}
                          onClick={() =>
                            onUpdateLine(
                              line.id,
                              "taxMode",
                              line.taxMode === "INCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE",
                            )
                          }
                          onFocus={() => handleCellFocus(line.id, "taxMode")}
                          onKeyDown={(event) => handleCellKeyDown(event, line.id, "taxMode")}
                        >
                          {line.taxMode === "INCLUSIVE" ? "Inc" : "Exc"}
                        </Button>
                      </TabularCell>
                    ) : null}
                    <TabularCell align="end" className={tabularNumericClassName}>
                      {formatCurrency(lineTotals.taxTotal)}
                    </TabularCell>
                    <TabularCell align="end" className={tabularNumericClassName}>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(lineTotals.total)}
                      </span>
                    </TabularCell>
                    {!isViewingPostedDocument ? (
                      <TabularCell align="center" className="p-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-[var(--tabular-row-height)] w-full rounded-none p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          onClick={() => onRemoveLine(line.id)}
                          title="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </TabularCell>
                    ) : null}
                  </TabularRow>
                );
              })}
            </TabularBody>
          </TabularSurface>
        </div>
      </div>
    </div>
  );
}
