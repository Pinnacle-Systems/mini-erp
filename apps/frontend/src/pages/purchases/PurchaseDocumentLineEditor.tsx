import { useRef } from "react";
import { Trash2 } from "lucide-react";
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
import {
  formatCurrency,
  getLineTotals,
  type PurchaseDocumentPageConfig,
  type PurchaseItemOption,
  type PurchaseLine,
} from "./usePurchaseDocumentWorkspace";

type PurchaseLineFieldKey =
  | "description"
  | "quantity"
  | "unitPrice"
  | "taxRate"
  | "taxMode";

type PurchaseDocumentLineEditorProps = {
  config: PurchaseDocumentPageConfig;
  lines: PurchaseLine[];
  linesCount: number;
  itemOptions: PurchaseItemOption[];
  lookupLoading: boolean;
  isViewingPostedDocument: boolean;
  onAppendLine: () => void;
  onApplyLineItem: (lineId: string, option: PurchaseItemOption) => void;
  onUpdateLine: (
    lineId: string,
    field: PurchaseLineFieldKey,
    value: string,
  ) => void;
  onRemoveLine: (lineId: string) => void;
};

const getPurchaseLineDescriptionInputId = (lineId: string) =>
  `purchase-line-desktop-description-${lineId}`;

const hasEditableLineContent = (line: PurchaseLine) =>
  Boolean(
    line.description.trim() ||
      line.unitPrice.trim() ||
      line.variantId.trim() ||
      (line.quantity.trim() &&
        line.quantity.trim() !== "0" &&
        line.quantity.trim() !== "1"),
  );

function PurchaseItemOptionContent({ option }: { option: PurchaseItemOption }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
        <span className="truncate">{option.description}</span>
        <span className="shrink-0">{formatCurrency(option.priceAmount ?? 0)}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {[option.sku, option.gstLabel].filter(Boolean).join(" • ")}
      </div>
    </div>
  );
}

const getPurchaseOriginBadgeClassName = (line: PurchaseLine) =>
  line.sourceLineId
    ? "bg-[#dff3ff] text-[#155b8f]"
    : "bg-slate-100 text-slate-600";

export function PurchaseDocumentLineEditor({
  config,
  lines,
  linesCount,
  itemOptions,
  lookupLoading,
  isViewingPostedDocument,
  onAppendLine,
  onApplyLineItem,
  onUpdateLine,
  onRemoveLine,
}: PurchaseDocumentLineEditorProps) {
  const desktopTableRef = useRef<HTMLDivElement | null>(null);
  const desktopGridTemplate = withTabularSerialNumberColumn(
    [
      "minmax(0,2.8fr)",
      "minmax(4.25rem,1fr)",
      "minmax(4.5rem,1fr)",
      "minmax(5rem,1.1fr)",
      "minmax(3.75rem,0.8fr)",
      "minmax(4.5rem,0.95fr)",
      "minmax(5rem,1fr)",
      ...(!isViewingPostedDocument ? ["2.25rem"] : []),
    ].join(" "),
  );

  const getLineFieldOrder = (lineId: string): PurchaseLineFieldKey[] => {
    if (isViewingPostedDocument) {
      return [];
    }

    const line = lines.find((entry) => entry.id === lineId);
    if (!line) {
      return [];
    }

    const fields: PurchaseLineFieldKey[] = [];
    if (!line.sourceLineId) {
      fields.push("description");
    }
    fields.push("quantity", "unitPrice", "taxRate", "taxMode");
    return fields;
  };

  const { getCellDataAttributes, handleCellFocus, handleCellKeyDown } =
    useSpreadsheetNavigation<PurchaseLineFieldKey>({
      containerRef: desktopTableRef,
      getRowOrder: () => lines.map((line) => line.id),
      getFieldOrderForRow: getLineFieldOrder,
      appendMode: "grow-as-needed",
      canAppendFromRow: (lineId) => {
        const line = lines.find((entry) => entry.id === lineId);
        return Boolean(line && hasEditableLineContent(line));
      },
      onRequestAppendRow: () => {
        onAppendLine();
      },
    });

  return (
    <div className="flex min-h-[14rem] flex-1 flex-col gap-1.5 pt-1 md:min-h-0 md:overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {`${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} Lines`}
          </div>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              isViewingPostedDocument
                ? "border border-border/45 bg-transparent text-muted-foreground/85"
                : "border border-border/70 bg-muted/55 text-muted-foreground",
            )}
          >
            {linesCount} {linesCount === 1 ? "line" : "lines"}
          </span>
        </div>
        {!isViewingPostedDocument ? (
          <Button type="button" variant="outline" size="sm" onClick={onAppendLine}>
            Add Line
          </Button>
        ) : null}
      </div>

      <div className="space-y-2 md:hidden">
        {lines.map((line, index) => {
          const lineTotals = getLineTotals(line);
          return (
            <div key={line.id} className="rounded-lg border border-border/80 bg-muted/55 p-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-foreground">Line {index + 1}</div>
                {!isViewingPostedDocument ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/12 hover:text-destructive"
                    onClick={() => onRemoveLine(line.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`purchase-line-mobile-description-${line.id}`}>Item</Label>
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <LookupDropdownInput
                          id={`purchase-line-mobile-description-${line.id}`}
                          value={line.description}
                          disabled={isViewingPostedDocument || Boolean(line.sourceLineId)}
                          onValueChange={(value) => onUpdateLine(line.id, "description", value)}
                          options={itemOptions}
                          loading={lookupLoading}
                          loadingLabel="Loading items"
                          placeholder="Search item or service"
                          onOptionSelect={(option) => onApplyLineItem(line.id, option)}
                          getOptionKey={(option) => option.variantId}
                          getOptionSearchText={(option) =>
                            `${option.label} ${option.sku} ${option.gstLabel}`
                          }
                          renderOption={(option) => <PurchaseItemOptionContent option={option} />}
                        />
                      </div>
                      {line.sourceLineId ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${getPurchaseOriginBadgeClassName(line)} cursor-help`}
                          title={`Linked qty available: ${line.linkedRemainingQuantity ?? line.quantity}`}
                        >
                          Linked
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Qty</Label>
                    <Input
                      value={line.quantity}
                      disabled={isViewingPostedDocument}
                      onChange={(event) =>
                        onUpdateLine(line.id, "quantity", event.target.value)
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Rate</Label>
                    <Input
                      value={line.unitPrice}
                      disabled={isViewingPostedDocument}
                      onChange={(event) =>
                        onUpdateLine(line.id, "unitPrice", event.target.value)
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Tax</Label>
                    <GstSlabSelect
                      value={normalizeGstSlab(line.taxRate) ?? "0%"}
                      onChange={(event) =>
                        onUpdateLine(line.id, "taxRate", event.target.value)
                      }
                      disabled={isViewingPostedDocument}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Tax mode</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-full justify-start text-xs"
                      disabled={isViewingPostedDocument}
                      onClick={() =>
                        onUpdateLine(
                          line.id,
                          "taxMode",
                          line.taxMode === "INCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE",
                        )
                      }
                    >
                      {line.taxMode === "INCLUSIVE" ? "Inclusive" : "Exclusive"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/80 bg-card px-2 py-1.5 text-xs">
                  <span className="text-muted-foreground">Line total</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(lineTotals.total)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
        <TabularSurface
          ref={desktopTableRef}
          role="grid"
          aria-label={`${config.singularLabel} lines`}
          className="min-h-0 h-full flex-1 overflow-y-auto overflow-x-hidden"
        >
          <TabularHeader>
            <TabularRow columns={desktopGridTemplate}>
              <TabularSerialNumberHeaderCell />
              <TabularCell variant="header">Item</TabularCell>
              <TabularCell variant="header" align="end">
                Qty
              </TabularCell>
              <TabularCell variant="header" align="end">
                Rate
              </TabularCell>
              <TabularCell variant="header">GST %</TabularCell>
              <TabularCell variant="header">Mode</TabularCell>
              <TabularCell variant="header" align="end">
                Tax
              </TabularCell>
              <TabularCell variant="header" align="end">
                Total
              </TabularCell>
              {!isViewingPostedDocument ? (
                <TabularCell variant="header" align="center" />
              ) : null}
            </TabularRow>
          </TabularHeader>
          <TabularBody>
            {lines.map((line, index) => {
              const lineTotals = getLineTotals(line);
              return (
                <TabularRow key={line.id} columns={desktopGridTemplate} interactive>
                  <TabularSerialNumberCell index={index} />
                  <TabularCell variant="editable">
                    <div className="relative min-w-0 flex-1 space-y-1">
                      <LookupDropdownInput
                        id={getPurchaseLineDescriptionInputId(line.id)}
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
                          <PurchaseItemOptionContent option={option} />
                        )}
                        containerClassName="w-full"
                        inputClassName={spreadsheetCellControlClassName}
                        inputUnstyled
                        inputProps={{
                          ...getCellDataAttributes(line.id, "description"),
                          onKeyDown: (event) =>
                            handleCellKeyDown(event, line.id, "description"),
                          onFocus: () => handleCellFocus(line.id, "description"),
                        }}
                      />
                      {line.sourceLineId ? (
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
                          <span
                            className={`pointer-events-auto inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getPurchaseOriginBadgeClassName(line)} cursor-help`}
                            title={`Linked qty available: ${line.linkedRemainingQuantity ?? line.quantity}`}
                          >
                            Linked
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </TabularCell>
                  <TabularCell variant="editable" align="end">
                    <div className="relative w-full">
                      <Input
                        unstyled
                        {...getCellDataAttributes(line.id, "quantity")}
                        className={cn(
                          spreadsheetCellControlClassName,
                          spreadsheetCellNumericClassName,
                          "w-full min-w-0 px-1 pr-7 lg:pr-8",
                        )}
                        value={line.quantity}
                        disabled={isViewingPostedDocument}
                        readOnly={isViewingPostedDocument}
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
                      className={cn(
                        spreadsheetCellControlClassName,
                        spreadsheetCellNumericClassName,
                        tabularNumericClassName,
                        "min-w-0 px-1.5 lg:px-2",
                      )}
                      value={line.unitPrice}
                      disabled={isViewingPostedDocument}
                      readOnly={isViewingPostedDocument}
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
                      className={cn(
                        spreadsheetCellSelectClassName,
                        "min-w-0 px-1 text-left text-[11px] lg:px-2 lg:text-xs",
                      )}
                      value={normalizeGstSlab(line.taxRate) ?? "0%"}
                      disabled={isViewingPostedDocument}
                      onChange={(event) =>
                        onUpdateLine(line.id, "taxRate", event.target.value)
                      }
                      onFocus={() => handleCellFocus(line.id, "taxRate")}
                      onKeyDown={(event) => handleCellKeyDown(event, line.id, "taxRate")}
                      placeholderOption="GST %"
                    />
                  </TabularCell>
                  <TabularCell variant="editable">
                    <Button
                      {...getCellDataAttributes(line.id, "taxMode")}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-[var(--tabular-row-height)] w-full min-w-0 rounded-none border-none bg-transparent px-0 text-[11px] text-muted-foreground shadow-none hover:bg-muted/55 lg:text-[10px]"
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
  );
}
