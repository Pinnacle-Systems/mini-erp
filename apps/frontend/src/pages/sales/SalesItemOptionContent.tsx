import {
  formatCurrency,
  type SalesItemOption,
} from "./useSalesDocumentWorkspace";

export function SalesItemOptionContent({
  option,
}: {
  option: SalesItemOption;
}) {
  return (
    <div className="space-y-0.5">
      <div className="font-medium text-foreground">{option.label}</div>
      <div className="text-[10px] text-muted-foreground">
        {[
          option.unit,
          option.gstLabel ? `GST ${option.gstLabel}` : null,
          option.priceAmount !== null
            ? formatCurrency(option.priceAmount)
            : "No sales price",
        ]
          .filter(Boolean)
          .join("  |  ")}
      </div>
    </div>
  );
}
