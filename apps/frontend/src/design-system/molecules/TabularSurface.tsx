import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
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
  truncate?: boolean;
  hoverTitle?: string | boolean;
};

const tabularReadOnlyCellClassName =
  "h-[var(--tabular-row-height)] bg-[var(--tabular-cell-bg)] text-[11px] font-normal leading-none transition-colors group-hover/tabular-row:bg-[var(--tabular-cell-hover-bg)] lg:text-[10px]";

const tabularGridCellChromeClassName = "tabular-grid-cell";

const getRowStyle = (columns: string): CSSProperties => ({
  gridTemplateColumns: columns,
});

const getAlignClassName = (align: TabularCellProps["align"]) => {
  if (align === "center") return "justify-center text-center";
  if (align === "end") return "justify-end text-right";
  return undefined;
};

const getHoverTitle = (
  hoverTitle: TabularCellProps["hoverTitle"],
  children: TabularCellProps["children"],
) => {
  if (typeof hoverTitle === "string") {
    return hoverTitle;
  }

  if (hoverTitle === true && (typeof children === "string" || typeof children === "number")) {
    return String(children);
  }

  return undefined;
};

export const TabularSurface = forwardRef<HTMLDivElement, TabularSurfaceProps>(
  ({ className, framed = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
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
  },
);

TabularSurface.displayName = "TabularSurface";

export function TabularHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="rowgroup"
      className={cn(
        "shrink-0 bg-[var(--tabular-header-bg)] [padding-inline-end:var(--tabular-scrollbar-gutter-width,0px)]",
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
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = bodyRef.current;
    const surface = element?.parentElement;
    if (!element || !surface) {
      return;
    }

    const updateScrollbarGutter = () => {
      const gutterWidth = Math.max(0, element.offsetWidth - element.clientWidth);
      surface.style.setProperty("--tabular-scrollbar-gutter-width", `${gutterWidth}px`);
    };

    updateScrollbarGutter();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollbarGutter();
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      surface.style.removeProperty("--tabular-scrollbar-gutter-width");
    };
  }, []);

  return (
    <div
      ref={bodyRef}
      role="rowgroup"
      className={cn(
        "tabular-scroll-region flex min-h-0 flex-1 flex-col overflow-y-auto bg-white",
        className,
      )}
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
        "tabular-grid-row grid shrink-0 !gap-0",
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
  truncate = false,
  hoverTitle,
  title,
  ...props
}: TabularCellProps) {
  const alignClassName = getAlignClassName(align);
  const resolvedTitle = title ?? getHoverTitle(hoverTitle, children);

  return (
    <div
      role={variant === "header" ? "columnheader" : "gridcell"}
      title={resolvedTitle}
      className={cn(
        variant === "header"
          ? cn(
              tabularHeaderCellClassName,
              tabularGridCellChromeClassName,
              "flex h-[var(--tabular-row-height)] items-center bg-[var(--tabular-header-bg)] text-[10px] uppercase leading-none tracking-[0.04em] [color:var(--tabular-header-text)]",
              alignClassName,
            )
          : variant === "editable"
            ? cn(
                tabularGridCellChromeClassName,
                getSpreadsheetCellClassName({ error, align }),
                "h-[var(--tabular-row-height)] flex items-center overflow-hidden leading-none",
                truncate ? "min-w-0" : undefined,
              )
            : cn(
                tabularCellBoxClassName,
                tabularGridCellChromeClassName,
                tabularReadOnlyCellClassName,
                "flex items-center",
                truncate ? "min-w-0 overflow-hidden whitespace-nowrap text-ellipsis" : undefined,
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
      className={cn(
        tabularFooterBarClassName,
        "[padding-inline-end:var(--tabular-scrollbar-gutter-width,0px)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
