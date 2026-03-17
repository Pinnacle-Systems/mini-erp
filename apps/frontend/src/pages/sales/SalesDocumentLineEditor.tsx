import { type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { LookupDropdownInput } from "../../design-system/molecules/LookupDropdownInput";
import { GstSlabSelect } from "../../design-system/molecules/GstSlabSelect";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../../design-system/molecules/DenseTable";
import { normalizeGstSlab } from "../../lib/gst-slabs";
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
  shouldShowOriginBadges: boolean;
  lineHeaderSlot?: ReactNode;
  onAppendLine: () => void;
  onApplyLineItem: (lineId: string, option: SalesItemOption) => void;
  onUpdateLine: (
    lineId: string,
    field: SalesLineFieldKey,
    value: string,
  ) => void;
  onRemoveLine: (lineId: string) => void;
  onHandleLineNavigation: (
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
    lineId: string,
    field: SalesLineFieldKey,
  ) => void;
  getLinkedLineCap: (line: BillLine) => number | null;
  getLineOriginTitle: (line: BillLine) => string | null;
  getOriginBadgeClassName: (line: BillLine) => string;
  getSameItemMixedOriginHint: (line: BillLine) => string | null;
};

export function SalesDocumentLineEditor({
  config,
  lines,
  itemOptions,
  lookupLoading,
  isViewingPostedDocument,
  shouldShowOriginBadges,
  lineHeaderSlot,
  onAppendLine,
  onApplyLineItem,
  onUpdateLine,
  onRemoveLine,
  onHandleLineNavigation,
  getLinkedLineCap,
  getLineOriginTitle,
  getOriginBadgeClassName,
  getSameItemMixedOriginHint,
}: SalesDocumentLineEditorProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 md:overflow-hidden">
      <div className="flex flex-col gap-2 md:shrink-0">
        <div className="flex items-center justify-between">
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
        {lines.map((line, index) => {
          const lineTotals = getLineTotals(line);
          return (
            <div
              key={line.id}
              data-bill-line-id={line.id}
              className="rounded-lg border border-border/80 bg-slate-50 p-2"
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
                    </div>
                    {shouldShowOriginBadges ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${getOriginBadgeClassName(line)} ${
                          line.sourceLineId ? "cursor-help" : ""
                        }`}
                        title={
                          line.sourceLineId
                            ? getLineOriginTitle(line) ?? undefined
                            : undefined
                        }
                      >
                        {line.sourceLineId ? "Linked" : "Ad-hoc"}
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

      <div className="hidden min-h-0 flex-1 overflow-hidden md:block">
        <DenseTable className="rounded-xl border-border/80 [scrollbar-gutter:stable]">
          <DenseTableHead>
            <tr>
              <DenseTableHeaderCell className="w-[36%]">Item</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[13%]">Qty</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[10%]">Rate</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[9%]">GST %</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[7%]">Mode</DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[9%] text-right">
                Tax
              </DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[9%] text-right">
                Total
              </DenseTableHeaderCell>
              <DenseTableHeaderCell className="w-[4%] text-right">
                {" "}
              </DenseTableHeaderCell>
            </tr>
          </DenseTableHead>
          <DenseTableBody>
            {lines.map((line) => {
              const lineTotals = getLineTotals(line);
              return (
                <DenseTableRow
                  key={line.id}
                  data-bill-line-id={line.id}
                  className="align-middle"
                >
                  <DenseTableCell className="py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="relative">
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
                          inputClassName="pr-24"
                          inputProps={{
                            onKeyDown: (event) =>
                              onHandleLineNavigation(
                                event,
                                line.id,
                                "description",
                              ),
                          }}
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
                          {shouldShowOriginBadges ? (
                            <span
                              className={`pointer-events-auto inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getOriginBadgeClassName(line)} ${
                                line.sourceLineId ? "cursor-help" : ""
                              }`}
                              title={
                                line.sourceLineId
                                  ? getLineOriginTitle(line) ?? undefined
                                  : undefined
                              }
                            >
                              {line.sourceLineId ? "Linked" : "Ad-hoc"}
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
                    </div>
                  </DenseTableCell>
                  <DenseTableCell className="py-1.5">
                    <div className="flex items-center gap-1">
                      <Input
                        data-sales-line-cell={`${line.id}:quantity`}
                        className="!w-[4.5rem] shrink-0 px-1 text-right"
                        value={line.quantity}
                        max={getLinkedLineCap(line) ?? undefined}
                        readOnly={isViewingPostedDocument}
                        disabled={isViewingPostedDocument}
                        onChange={(event) =>
                          onUpdateLine(line.id, "quantity", event.target.value)
                        }
                        onKeyDown={(event) =>
                          onHandleLineNavigation(event, line.id, "quantity")
                        }
                        inputMode="decimal"
                      />
                      <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                        {line.unit || "PCS"}
                      </span>
                    </div>
                  </DenseTableCell>
                  <DenseTableCell className="py-1.5">
                    <Input
                      data-sales-line-cell={`${line.id}:unitPrice`}
                      className="min-w-0 px-2 text-right"
                      value={line.unitPrice}
                      readOnly={isViewingPostedDocument}
                      disabled={isViewingPostedDocument}
                      onChange={(event) =>
                        onUpdateLine(line.id, "unitPrice", event.target.value)
                      }
                      onKeyDown={(event) =>
                        onHandleLineNavigation(event, line.id, "unitPrice")
                      }
                      inputMode="decimal"
                    />
                  </DenseTableCell>
                  <DenseTableCell className="py-1.5">
                    <GstSlabSelect
                      data-sales-line-cell={`${line.id}:taxRate`}
                      className="h-8 min-w-0 bg-white px-2 text-left text-xs"
                      value={normalizeGstSlab(line.taxRate) || ""}
                      disabled={isViewingPostedDocument}
                      onChange={(e) =>
                        onUpdateLine(line.id, "taxRate", e.target.value)
                      }
                      onKeyDown={(event) =>
                        onHandleLineNavigation(event, line.id, "taxRate")
                      }
                      placeholderOption="GST %"
                    />
                  </DenseTableCell>
                  <DenseTableCell className="py-1.5">
                    <Button
                      data-sales-line-cell={`${line.id}:taxMode`}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full min-w-0 border-border/70 px-0 text-xs text-muted-foreground"
                      disabled={isViewingPostedDocument}
                      onClick={() =>
                        onUpdateLine(
                          line.id,
                          "taxMode",
                          line.taxMode === "INCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE",
                        )
                      }
                      onKeyDown={(event) =>
                        onHandleLineNavigation(event, line.id, "taxMode")
                      }
                    >
                      {line.taxMode === "INCLUSIVE" ? "Inc" : "Exc"}
                    </Button>
                  </DenseTableCell>
                  <DenseTableCell className="py-1.5 text-right">
                    <div className="flex h-8 items-center justify-end whitespace-nowrap text-[11px] font-medium text-foreground">
                      {formatCurrency(lineTotals.taxTotal)}
                    </div>
                  </DenseTableCell>
                  <DenseTableCell className="py-1.5 text-right">
                    <div className="flex h-8 items-center justify-end whitespace-nowrap text-[11px] font-semibold text-foreground">
                      {formatCurrency(lineTotals.total)}
                    </div>
                  </DenseTableCell>
                  <DenseTableCell className="py-1.5 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      onClick={() => onRemoveLine(line.id)}
                      title="Remove line"
                      disabled={isViewingPostedDocument}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </DenseTableCell>
                </DenseTableRow>
              );
            })}
          </DenseTableBody>
        </DenseTable>
      </div>
    </div>
  );
}
