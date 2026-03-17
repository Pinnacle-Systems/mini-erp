import { cn } from "../../lib/utils";

const SPREADSHEET_GRID_LINE_COLOR = "bg-[#c9d3df]";

export const spreadsheetGridClassName = cn(
  "lg:gap-px",
  SPREADSHEET_GRID_LINE_COLOR,
);

export const spreadsheetHeaderCellClassName = cn(
  "flex min-h-6 items-center bg-slate-50 px-2 py-1",
);

export const spreadsheetCellControlClassName = cn(
  "h-8 w-full rounded-none border-0 bg-transparent px-2.5 text-[11px] shadow-none placeholder:text-[#8ea0b3] lg:h-6 lg:px-2 lg:text-[10px]",
  "focus:border-transparent focus:bg-transparent focus:outline-none focus:ring-0",
  "disabled:bg-transparent",
);

export const spreadsheetCellSelectClassName = cn(
  spreadsheetCellControlClassName,
  "pr-7",
);

export const spreadsheetCellNumericClassName = "text-right tabular-nums";

type SpreadsheetCellClassNameOptions = {
  error?: boolean;
  readOnly?: boolean;
  align?: "start" | "center" | "end";
};

export function getSpreadsheetCellClassName({
  error = false,
  readOnly = false,
  align = "start",
}: SpreadsheetCellClassNameOptions = {}) {
  return cn(
    "relative min-h-8 border border-transparent bg-white shadow-[inset_0_0_0_1px_rgba(201,211,223,0.7)] transition-none",
    "lg:min-h-6",
    !readOnly
      ? "hover:bg-slate-50/75 hover:shadow-[inset_0_0_0_1px_rgba(173,184,197,0.9)]"
      : "bg-slate-50/85 text-muted-foreground",
    align === "center" ? "flex items-center justify-center" : undefined,
    align === "end" ? "flex items-center justify-end" : undefined,
    error
      ? "bg-red-50/85 text-[#7f1d1d] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.55)] hover:bg-red-50 focus-within:border-red-500 focus-within:bg-red-50 focus-within:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.7)]"
      : "focus-within:bg-white",
    "focus-within:z-10",
    error
      ? undefined
      : "focus-within:border-[#4f8dd8] focus-within:shadow-[inset_0_0_0_1px_rgba(79,141,216,0.75)]",
  );
}
