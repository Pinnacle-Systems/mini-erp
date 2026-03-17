import { MoreHorizontal } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { IconButton } from "../../design-system/atoms/IconButton";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../../design-system/molecules/DenseTable";
import {
  formatCurrency,
  formatDateTime,
  type InvoiceListRow,
  type RowMenuAction,
  type SalesDocumentPageConfig,
} from "./useSalesDocumentWorkspace";

type SalesDocumentListViewProps = {
  config: SalesDocumentPageConfig;
  saveMessage: string | null;
  serverInvoicesError: string | null;
  serverInvoicesLoading: boolean;
  invoiceRows: InvoiceListRow[];
  activeDraftId: string | null;
  openRowMenuId: string | null;
  onOpenNewDraft: () => void;
  onToggleRowMenu: (
    rowId: string,
    triggerElement: HTMLButtonElement,
  ) => void;
  getRowMenuActions: (row: InvoiceListRow) => RowMenuAction[];
};

export function SalesDocumentListView({
  config,
  saveMessage,
  serverInvoicesError,
  serverInvoicesLoading,
  invoiceRows,
  activeDraftId,
  openRowMenuId,
  onOpenNewDraft,
  onToggleRowMenu,
  getRowMenuActions,
}: SalesDocumentListViewProps) {
  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <div className="flex flex-col rounded-xl border border-border/85 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:min-h-0 lg:flex-1">
        <div className="flex flex-col gap-2 border-b border-border/70 pb-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-sm font-semibold text-foreground">
              {config.listTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              Draft and posted {config.pluralLabel} are shown together here.
              Status indicates whether a document is still local or already
              posted.
            </p>
          </div>
          <Button type="button" size="sm" onClick={onOpenNewDraft}>
            {config.createActionLabel}
          </Button>
        </div>

        <div className="space-y-2 pt-2 lg:hidden">
          {saveMessage ? (
            <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-[11px] text-muted-foreground">
              {saveMessage}
            </div>
          ) : null}
          {serverInvoicesError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-3 text-xs text-red-700">
              {serverInvoicesError}
            </div>
          ) : null}
          {serverInvoicesLoading ? (
            <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
              {`Loading ${config.pluralLabel}...`}
            </div>
          ) : null}
          {invoiceRows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
              {config.listEmptyMessage}
            </div>
          ) : (
            invoiceRows.map((row) => (
              <div
                key={`${row.source}:${row.id}`}
                className={`rounded-lg border px-2 py-2 text-xs ${
                  row.source === "local" && row.id === activeDraftId
                    ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
                    : "border-border/70 bg-white text-foreground"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{row.billNumber}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {row.customerName}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {row.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>{formatDateTime(row.timestamp)}</span>
                  <span>{formatCurrency(row.total)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>
                    {row.lines.length} line{row.lines.length === 1 ? "" : "s"}
                  </span>
                  {(() => {
                    const actions = getRowMenuActions(row);
                    if (actions.length === 0) {
                      return null;
                    }

                    return (
                      <div
                        className="relative"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <IconButton
                          type="button"
                          icon={MoreHorizontal}
                          variant="ghost"
                          className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                          aria-label={`Open actions for ${row.billNumber}`}
                          title="More actions"
                          aria-expanded={openRowMenuId === row.id}
                          onClick={(event) =>
                            onToggleRowMenu(row.id, event.currentTarget)
                          }
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {saveMessage ? (
            <div className="mt-2 rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-[11px] text-muted-foreground">
              {saveMessage}
            </div>
          ) : null}
          {serverInvoicesError ? (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-3 text-xs text-red-700">
              {serverInvoicesError}
            </div>
          ) : null}
          {serverInvoicesLoading ? (
            <div className="mt-2 rounded-md border border-border/70 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
              {`Loading ${config.pluralLabel}...`}
            </div>
          ) : null}
          {invoiceRows.length === 0 ? (
            <div className="mt-2 rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
              {config.listEmptyMessage}
            </div>
          ) : (
            <DenseTable className="mt-2 rounded-xl border-border/80">
              <DenseTableHead>
                <tr>
                  <DenseTableHeaderCell className="w-[14%]">
                    Number
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[22%]">
                    Customer
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[10%]">
                    Status
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[10%]">
                    Lines
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[14%]">
                    Total
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[18%]">
                    Updated
                  </DenseTableHeaderCell>
                  <DenseTableHeaderCell className="w-[12%] text-right">
                    Actions
                  </DenseTableHeaderCell>
                </tr>
              </DenseTableHead>
              <DenseTableBody>
                {invoiceRows.map((row) => (
                  <DenseTableRow key={`${row.source}:${row.id}`}>
                    <DenseTableCell className="font-semibold text-foreground">
                      {row.billNumber}
                    </DenseTableCell>
                    <DenseTableCell>{row.customerName}</DenseTableCell>
                    <DenseTableCell>{row.status}</DenseTableCell>
                    <DenseTableCell>
                      {row.lines.length} line
                      {row.lines.length === 1 ? "" : "s"}
                    </DenseTableCell>
                    <DenseTableCell className="font-semibold text-foreground">
                      {formatCurrency(row.total)}
                    </DenseTableCell>
                    <DenseTableCell>{formatDateTime(row.timestamp)}</DenseTableCell>
                    <DenseTableCell className="text-right">
                      {(() => {
                        const actions = getRowMenuActions(row);
                        if (actions.length === 0) {
                          return (
                            <span className="text-[11px] text-muted-foreground">
                              Posted
                            </span>
                          );
                        }

                        return (
                          <div
                            className="relative inline-flex"
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            <IconButton
                              type="button"
                              icon={MoreHorizontal}
                              variant="ghost"
                              className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                              onClick={(event) =>
                                onToggleRowMenu(row.id, event.currentTarget)
                              }
                              aria-label={`Open actions for ${row.billNumber}`}
                              title="More actions"
                              aria-expanded={openRowMenuId === row.id}
                            />
                          </div>
                        );
                      })()}
                    </DenseTableCell>
                  </DenseTableRow>
                ))}
              </DenseTableBody>
            </DenseTable>
          )}
        </div>
      </div>
    </section>
  );
}
