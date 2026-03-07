import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

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
    <td className={cn("px-2.5 py-0 align-middle", className)} {...props}>
      {children}
    </td>
  );
}
