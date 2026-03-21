import { cn } from "../../lib/utils";
import {
  tabularHeaderCellClassName,
} from "./tabularTokens";

const SPREADSHEET_GRID_LINE_COLOR = "bg-[var(--tabular-grid-line-color)]";

export const spreadsheetGridClassName = cn(
  "lg:gap-px",
  SPREADSHEET_GRID_LINE_COLOR,
);

export const spreadsheetHeaderCellClassName = cn(
  tabularHeaderCellClassName,
  "flex min-h-6 items-center bg-[var(--tabular-header-bg)]",
);

export const spreadsheetCellControlClassName = cn(
  "h-full min-h-0 w-full rounded-none !border-0 !bg-transparent px-2.5 py-0 text-[11px] leading-[var(--tabular-row-height)] !shadow-none placeholder:text-foreground/45 transition-colors lg:px-2 lg:text-[10px]",
  "focus:!border-transparent focus:!bg-transparent focus:!outline-none focus:!ring-0",
  "disabled:!bg-transparent",
);

export const spreadsheetCellSelectClassName = cn(
  spreadsheetCellControlClassName,
  "appearance-none pr-6 bg-[length:12px_12px] bg-[position:right_6px_center] bg-no-repeat",
  "bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' stroke='%2364758b' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]",
  "hover:bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' stroke='%23475569' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]",
  "focus:bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' stroke='%23475569' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]",
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
    "relative h-[var(--tabular-row-height)] justify-start rounded-none transition-colors transition-shadow",
    !readOnly ? "bg-card hover:bg-[var(--tabular-row-hover-bg)]" : "bg-transparent text-muted-foreground",
    "items-center leading-none",
    align === "center" ? "flex justify-center" : undefined,
    align === "end" ? "flex justify-end" : undefined,
    align === "start" ? "flex" : undefined,
    error
      ? "z-20 bg-destructive/12 text-destructive shadow-[inset_0_0_0_2px_hsl(var(--destructive)/0.72)]"
      : "focus-within:bg-card focus-within:z-10 focus-within:shadow-[inset_0_0_0_2px_hsl(var(--ring))]",
    error
      ? undefined
      : undefined,
  );
}
