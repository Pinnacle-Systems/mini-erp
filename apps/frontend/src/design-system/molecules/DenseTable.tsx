import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

export const DENSE_TABLE_COLUMN_WIDTHS = {
  item: "w-[28%]",
  variant: "w-[24%]",
  sku: "w-[14%]",
  category: "w-[14%]",
  status: "w-[12%]",
  quantity: "w-[16%]",
  action: "w-16",
  price: "w-36",
  unit: "w-20",
} as const;

type DenseTableProps = HTMLAttributes<HTMLDivElement> & {
  tableClassName?: string;
};

export function DenseTable({
  className,
  tableClassName,
  children,
  ...props
}: DenseTableProps) {
  return (
    <div
      className={cn(
        "hidden rounded-lg border border-border/85 bg-white lg:block lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto",
        className,
      )}
      {...props}
    >
      <table className={cn("w-full table-fixed border-collapse text-left text-[11px]", tableClassName)}>
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
        "sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-muted-foreground",
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
    <tr className={cn("border-t border-border/70 align-middle", className)} {...props}>
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
    <th className={cn("px-2.5 py-2 font-semibold", className)} {...props}>
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
    <td className={cn("px-2.5 py-2 align-middle", className)} {...props}>
      {children}
    </td>
  );
}
