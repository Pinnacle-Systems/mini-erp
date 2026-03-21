import { useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { IconButton } from "../../design-system/atoms/IconButton";
import {
  TabularBody,
  TabularCell,
  TabularHeader,
  TabularRow,
  TabularSerialNumberCell,
  TabularSerialNumberHeaderCell,
  TabularSurface,
} from "../../design-system/molecules/TabularSurface";
import { withTabularSerialNumberColumn } from "../../design-system/molecules/tabularSerialNumbers";
import { useToast } from "../../features/toast/useToast";
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
  const { showToast } = useToast();
  const lastSaveMessageRef = useRef<string | null>(null);
  const showSourceColumn = config.documentType !== "SALES_ESTIMATE";
  const desktopGridTemplate = withTabularSerialNumberColumn(
    showSourceColumn
      ? "minmax(0,1.1fr) minmax(0,1.7fr) minmax(0,1.1fr) minmax(0,0.85fr) minmax(0,1.05fr) minmax(0,1.2fr) 3rem"
      : "minmax(0,1.2fr) minmax(0,1.9fr) minmax(0,0.95fr) minmax(0,1.1fr) minmax(0,1.2fr) 3rem",
  );
  const getParentDocumentNumber = (row: InvoiceListRow) => {
    const parentId =
      row.source === "local" ? (row.draft.parentId ?? null) : (row.invoice.parentId ?? null);
    if (!parentId) {
      return "None";
    }

    return (
      invoiceRows.find((candidate) => candidate.id === parentId)?.billNumber ?? "Unknown"
    );
  };

  useEffect(() => {
    if (!saveMessage || saveMessage === lastSaveMessageRef.current) {
      return;
    }

    lastSaveMessageRef.current = saveMessage;
    showToast({
      title: saveMessage,
      tone: "success",
      dedupeKey: `sales-document-list:${saveMessage}`,
    });
  }, [saveMessage, showToast]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <div className="flex flex-col rounded-xl border border-border/85 bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:min-h-0 lg:flex-1">
        <div className="flex flex-col gap-2 border-b border-border/70 pb-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-sm font-semibold text-foreground">
              {config.listTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              See your draft and posted {config.pluralLabel} in one place.
              The status shows whether each document is still in draft or has
              already been posted.
            </p>
          </div>
          <Button type="button" size="sm" onClick={onOpenNewDraft}>
            {config.createActionLabel}
          </Button>
        </div>

        <div className="space-y-2 pt-2 lg:hidden">
          {serverInvoicesError ? (
            <div className="rounded-md border border-destructive/35 bg-destructive/12 px-2 py-3 text-xs text-destructive">
              {serverInvoicesError}
            </div>
          ) : null}
          {serverInvoicesLoading ? (
            <div className="rounded-md border border-border/70 bg-muted/55 px-2 py-3 text-xs text-muted-foreground">
              {`Loading ${config.pluralLabel}...`}
            </div>
          ) : null}
          {invoiceRows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/80 bg-muted/55 px-2 py-3 text-xs text-muted-foreground">
              {config.listEmptyMessage}
            </div>
          ) : (
            invoiceRows.map((row) => (
              <div
                key={`${row.source}:${row.id}`}
                className={`rounded-lg border px-2 py-2 text-xs ${
                  row.source === "local" && row.id === activeDraftId
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border/70 bg-card text-foreground"
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
                {showSourceColumn ? (
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate">
                      {`Source: ${getParentDocumentNumber(row)}`}
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
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-primary hover:bg-muted/55"
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
                ) : (
                  <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
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
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-primary hover:bg-muted/55"
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
                )}
              </div>
            ))
          )}
        </div>

        <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          {serverInvoicesError ? (
            <div className="mt-2 rounded-md border border-destructive/35 bg-destructive/12 px-2 py-3 text-xs text-destructive">
              {serverInvoicesError}
            </div>
          ) : null}
          {serverInvoicesLoading ? (
            <div className="mt-2 rounded-md border border-border/70 bg-muted/55 px-2 py-3 text-xs text-muted-foreground">
              {`Loading ${config.pluralLabel}...`}
            </div>
          ) : null}
          {invoiceRows.length === 0 ? (
            <div className="mt-2 rounded-md border border-dashed border-border/80 bg-muted/55 px-2 py-3 text-xs text-muted-foreground">
              {config.listEmptyMessage}
            </div>
          ) : (
            <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
              <TabularSurface className="min-h-0 flex-1 overflow-hidden bg-card">
                <TabularHeader>
                  <TabularRow columns={desktopGridTemplate}>
                    <TabularSerialNumberHeaderCell />
                    <TabularCell variant="header">Number</TabularCell>
                    <TabularCell variant="header">Customer</TabularCell>
                    {showSourceColumn ? (
                      <TabularCell variant="header">Source</TabularCell>
                    ) : null}
                    <TabularCell variant="header">Status</TabularCell>
                    <TabularCell variant="header" align="end">Total</TabularCell>
                    <TabularCell variant="header">Updated</TabularCell>
                    <TabularCell variant="header" align="center">Actions</TabularCell>
                  </TabularRow>
                </TabularHeader>
                <TabularBody className="overflow-y-auto">
                {invoiceRows.map((row, index) => (
                  <TabularRow key={`${row.source}:${row.id}`} columns={desktopGridTemplate} interactive>
                    <TabularSerialNumberCell index={index} />
                    <TabularCell truncate hoverTitle={row.billNumber} className="font-semibold text-foreground">
                      {row.billNumber}
                    </TabularCell>
                    <TabularCell truncate hoverTitle={row.customerName}>
                      {row.customerName}
                    </TabularCell>
                    {showSourceColumn ? (
                      <TabularCell truncate hoverTitle={getParentDocumentNumber(row)}>
                        {getParentDocumentNumber(row)}
                      </TabularCell>
                    ) : null}
                    <TabularCell>{row.status}</TabularCell>
                    <TabularCell align="end" className="font-semibold text-foreground">
                      {formatCurrency(row.total)}
                    </TabularCell>
                    <TabularCell truncate hoverTitle={formatDateTime(row.timestamp)}>
                      {formatDateTime(row.timestamp)}
                    </TabularCell>
                    <TabularCell align="center">
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
                              className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-primary hover:bg-muted/55"
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
                    </TabularCell>
                  </TabularRow>
                ))}
                </TabularBody>
              </TabularSurface>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
