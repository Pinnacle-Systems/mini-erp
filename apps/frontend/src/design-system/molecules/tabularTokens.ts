export const TABULAR_CSS_VARS = {
  frameBorderColor: "--tabular-frame-border-color",
  frameBorderWidth: "--tabular-frame-border-width",
  frameRadius: "--tabular-frame-radius",
  headerBackground: "--tabular-header-bg",
  headerTextColor: "--tabular-header-text",
  gridLineColor: "--tabular-grid-line-color",
  cellPaddingX: "--tabular-cell-padding-x",
  cellPaddingY: "--tabular-cell-padding-y",
  rowHeight: "--tabular-row-height",
  footerHeight: "--tabular-footer-height",
  footerButtonHeight: "--tabular-footer-button-height",
  numericFeatureSettings: "--tabular-num-features",
} as const;

export const tabularFrameClassName =
  "rounded-[var(--tabular-frame-radius)] border bg-card [border-color:var(--tabular-frame-border-color)] [border-width:var(--tabular-frame-border-width)]";

export const tabularHeaderSectionClassName =
  "sticky top-0 z-10 bg-[var(--tabular-header-bg)] text-[10px] uppercase tracking-[0.05em] [color:var(--tabular-header-text)]";

export const tabularHeaderCellClassName =
  "px-[var(--tabular-cell-padding-x)] py-0 font-semibold";

export const tabularCellBoxClassName =
  "h-[var(--tabular-row-height)] px-[var(--tabular-cell-padding-x)] py-0 align-middle text-[11px] lg:text-[10px]";

export const tabularNumericClassName =
  "text-right [font-feature-settings:var(--tabular-num-features)] tabular-nums";

export const tabularFooterBarClassName =
  "flex min-h-[var(--tabular-footer-height)] items-center justify-between border-t bg-[var(--tabular-header-bg)] px-1 py-px text-[10px] [color:var(--tabular-header-text)] [border-color:var(--tabular-frame-border-color)]";

export const tabularFooterButtonClassName =
  "h-[var(--tabular-footer-button-height)] px-1.5";
