import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import {
  tabularCellBoxClassName,
  tabularFooterBarClassName,
  tabularFrameClassName,
  tabularHeaderCellClassName,
} from "./tabularTokens";
import { getSpreadsheetCellClassName } from "./spreadsheetStyles";

type TabularSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  framed?: boolean;
};

type TabularRowProps = HTMLAttributes<HTMLDivElement> & {
  columns: string;
  interactive?: boolean;
};

type TabularCellProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "header" | "body" | "editable";
  align?: "start" | "center" | "end";
  error?: boolean;
};

const tabularReadOnlyCellClassName =
  "min-h-[var(--tabular-row-height)] bg-[var(--tabular-cell-bg)] text-[11px] leading-none transition-colors group-hover/tabular-row:bg-[var(--tabular-cell-hover-bg)]";

const tabularGridCellChromeClassName =
  "border-r border-b [border-color:var(--tabular-grid-line-color)] [&:last-child]:border-r-0";

const getRowStyle = (columns: string): CSSProperties => ({
  gridTemplateColumns: columns,
});

const getAlignClassName = (align: TabularCellProps["align"]) => {
  if (align === "center") return "justify-center text-center";
  if (align === "end") return "justify-end text-right";
  return undefined;
};

export function TabularSurface({
  className,
  framed = true,
  children,
  ...props
}: TabularSurfaceProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-white",
        framed ? tabularFrameClassName : undefined,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabularHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="rowgroup"
      className={cn(
        "shrink-0 bg-[var(--tabular-header-bg)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabularBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="rowgroup"
      className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto bg-white", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabularRow({
  className,
  columns,
  interactive = false,
  children,
  ...props
}: TabularRowProps) {
  return (
    <div
      role="row"
      className={cn(
        "grid shrink-0",
        interactive ? "group/tabular-row" : undefined,
        className,
      )}
      style={getRowStyle(columns)}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabularCell({
  className,
  children,
  variant = "body",
  align = "start",
  error = false,
  ...props
}: TabularCellProps) {
  const alignClassName = getAlignClassName(align);

  return (
    <div
      role={variant === "header" ? "columnheader" : "gridcell"}
      className={cn(
        variant === "header"
          ? cn(
              tabularHeaderCellClassName,
              tabularGridCellChromeClassName,
              "flex min-h-[var(--tabular-row-height)] items-center bg-[var(--tabular-header-bg)] text-[10px] uppercase leading-none tracking-[0.05em] [color:var(--tabular-header-text)]",
              alignClassName,
            )
          : variant === "editable"
            ? cn(
                tabularGridCellChromeClassName,
                getSpreadsheetCellClassName({ error, align }),
                "flex items-center overflow-hidden leading-none",
              )
            : cn(
                tabularCellBoxClassName,
                tabularGridCellChromeClassName,
                tabularReadOnlyCellClassName,
                "flex items-center",
                alignClassName,
              ),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabularFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(tabularFooterBarClassName, className)}
      {...props}
    >
      {children}
    </div>
  );
}
