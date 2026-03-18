import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";
import {
  tabularCellBoxClassName,
  tabularFrameClassName,
  tabularHeaderCellClassName,
  tabularHeaderSectionClassName,
} from "./tabularTokens";

const denseTableSurfaceClassName = tabularFrameClassName;

const denseTableHeaderSectionClassName = tabularHeaderSectionClassName;

const denseTableHeaderCellClassName = cn(
  tabularHeaderCellClassName,
  "h-[var(--tabular-row-height)] border-r border-b last:border-r-0 [border-color:var(--tabular-grid-line-color)]",
);

const denseTableCellClassName = cn(
  tabularCellBoxClassName,
  "bg-[var(--tabular-cell-bg)] last:border-r-0 first:border-l-0",
);

type DenseTableProps = HTMLAttributes<HTMLDivElement> & {
  framed?: boolean;
  tableClassName?: string;
};

export function DenseTable({
  className,
  framed = true,
  tableClassName,
  children,
  ...props
}: DenseTableProps) {
  return (
    <div
      className={cn(
        "hidden lg:block lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto",
        framed ? denseTableSurfaceClassName : undefined,
        className,
      )}
      {...props}
    >
      <table
        className={cn(
          "w-full table-fixed border-collapse text-left text-[11px]",
          tableClassName,
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function DenseTableHead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        denseTableHeaderSectionClassName,
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function DenseTableBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn(className)} {...props}>
      {children}
    </tbody>
  );
}

export function DenseTableRow({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "align-middle [&:hover>td]:bg-[var(--tabular-cell-hover-bg)] [&>td]:h-[var(--tabular-row-height)]",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function DenseTableHeaderCell({
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn(denseTableHeaderCellClassName, className)} {...props}>
      {children}
    </th>
  );
}

export function DenseTableCell({
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn(denseTableCellClassName, className)} {...props}>
      {children}
    </td>
  );
}
