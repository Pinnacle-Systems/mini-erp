import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
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
  rows?: string;
  interactive?: boolean;
};

type TabularCellProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "header" | "body" | "editable";
  align?: "start" | "center" | "end";
  error?: boolean;
  truncate?: boolean;
  hoverTitle?: string | boolean;
  span?: number;
  rowSpan?: number;
};

type TabularSerialNumberCellProps = Omit<TabularCellProps, "children"> & {
  index: number;
};

const tabularReadOnlyCellClassName =
  "h-[var(--tabular-row-height)] bg-card text-[11px] font-normal leading-none text-card-foreground transition-colors group-hover/tabular-row:bg-[var(--tabular-row-hover-bg)] lg:text-[10px]";

const tabularGridCellChromeClassName = "tabular-grid-cell";

const getRowStyle = (columns: string, rows?: string): CSSProperties => ({
  gridTemplateColumns: columns,
  ...(rows ? { gridTemplateRows: rows } : {}),
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

const getElementText = (element: HTMLDivElement | null) => {
  if (!element) return undefined;

  const editableValueElement = element.querySelector("input, textarea, select") as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (editableValueElement) {
    if (editableValueElement instanceof HTMLSelectElement) {
      return (
        editableValueElement.selectedOptions[0]?.textContent?.replace(/\s+/g, " ").trim() ||
        editableValueElement.value ||
        undefined
      );
    }

    return editableValueElement.value || editableValueElement.placeholder || undefined;
  }

  const labeledElement = element.querySelector("[aria-label], [title]") as HTMLElement | null;
  const label =
    labeledElement?.getAttribute("aria-label") || labeledElement?.getAttribute("title");
  if (label) return label;

  return element.textContent?.replace(/\s+/g, " ").trim() || undefined;
};

const isElementOverflowing = (element: HTMLElement) =>
  element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;

const isCellContentOverflowing = (element: HTMLDivElement) => {
  if (isElementOverflowing(element)) {
    return true;
  }

  const contentElement = element.querySelector("input, textarea, select, button, [data-overflow-title]") as
    | HTMLElement
    | null;
  return contentElement ? isElementOverflowing(contentElement) : false;
};

export const TabularSurface = forwardRef<HTMLDivElement, TabularSurfaceProps>(
  ({ className, framed = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-0 flex-col overflow-hidden bg-card",
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
        "tabular-scroll-region flex min-h-0 flex-1 flex-col overflow-y-auto bg-card text-card-foreground",
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
  rows,
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
      style={getRowStyle(columns, rows)}
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
  onMouseEnter,
  onFocus,
  span,
  rowSpan,
  style,
  ...props
}: TabularCellProps) {
  const cellRef = useRef<HTMLDivElement | null>(null);
  const [overflowTitle, setOverflowTitle] = useState<string | undefined>();
  const alignClassName = getAlignClassName(align);
  const fallbackTitle = getHoverTitle(hoverTitle, children);
  const resolvedTitle = title ?? overflowTitle;

  const updateOverflowTitle = () => {
    if (title) {
      return;
    }

    const element = cellRef.current;
    if (!element) {
      setOverflowTitle(undefined);
      return;
    }

    const isOverflowing = isCellContentOverflowing(element);
    setOverflowTitle(isOverflowing ? fallbackTitle ?? getElementText(element) : undefined);
  };

  return (
    <div
      ref={cellRef}
      role={variant === "header" ? "columnheader" : "gridcell"}
      title={resolvedTitle}
      data-truncate={truncate ? "true" : undefined}
      onMouseEnter={(event) => {
        updateOverflowTitle();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        updateOverflowTitle();
        onFocus?.(event);
      }}
      style={{
        ...(span && span > 1 ? { gridColumn: `span ${span} / span ${span}` } : {}),
        ...(rowSpan && rowSpan > 1 ? { gridRow: `span ${rowSpan} / span ${rowSpan}` } : {}),
        ...style,
      }}
      className={cn(
        variant === "header"
          ? cn(
              tabularHeaderCellClassName,
              tabularGridCellChromeClassName,
              rowSpan && rowSpan > 1 ? "h-full" : "h-[var(--tabular-row-height)]",
              "flex min-w-0 items-center overflow-hidden whitespace-nowrap text-ellipsis bg-[var(--tabular-header-bg)] text-[10px] uppercase leading-none tracking-[0.04em] [color:var(--tabular-header-text)]",
              alignClassName,
            )
          : variant === "editable"
            ? cn(
                tabularGridCellChromeClassName,
                getSpreadsheetCellClassName({ error, align }),
                "h-[var(--tabular-row-height)] flex min-w-0 items-center overflow-hidden leading-none",
              )
            : cn(
                tabularCellBoxClassName,
                tabularGridCellChromeClassName,
                tabularReadOnlyCellClassName,
                "flex min-w-0 items-center overflow-hidden whitespace-nowrap text-ellipsis",
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

export function TabularSerialNumberHeaderCell({
  className,
  children = "S/N",
  ...props
}: Omit<TabularCellProps, "variant" | "align">) {
  return (
    <TabularCell variant="header" align="center" className={className} {...props}>
      {children}
    </TabularCell>
  );
}

export function TabularSerialNumberCell({
  index,
  className,
  ...props
}: TabularSerialNumberCellProps) {
  return (
    <TabularCell
      align="center"
      className={cn("font-medium text-muted-foreground", className)}
      hoverTitle={`Row ${index + 1}`}
      {...props}
    >
      {index + 1}
    </TabularCell>
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
