import { AlertCircle, ClipboardList, FileText, PackageCheck, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../design-system/atoms/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
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
import { useSessionStore } from "../../features/auth/session-business";
import {
  getPurchaseOverview,
  type PurchaseDocumentType,
  type PurchaseOverview,
} from "./purchase-documents-api";

const quickActions = [
  { label: "New Order", route: "/app/purchase-orders/new", Icon: ClipboardList },
  { label: "New Goods Receipt", route: "/app/goods-receipt-notes/new", Icon: PackageCheck },
  { label: "New Invoice", route: "/app/purchase-invoices/new", Icon: FileText },
  { label: "New Return", route: "/app/purchase-returns/new", Icon: Undo2 },
];

const reviewActions = [
  { label: "Orders", route: "/app/purchase-orders", Icon: ClipboardList },
  { label: "Goods Receipts", route: "/app/goods-receipt-notes", Icon: PackageCheck },
  { label: "Invoices", route: "/app/purchase-invoices", Icon: FileText },
  { label: "Returns", route: "/app/purchase-returns", Icon: Undo2 },
];

const documentTypeLabel: Record<PurchaseDocumentType, string> = {
  PURCHASE_ORDER: "Order",
  GOODS_RECEIPT_NOTE: "Goods Receipt",
  PURCHASE_INVOICE: "Invoice",
  PURCHASE_RETURN: "Return",
};

const formatCurrency = (value: number | null) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getDocumentRoute = (documentType: PurchaseDocumentType, id: string) => {
  switch (documentType) {
    case "PURCHASE_ORDER":
      return `/app/purchase-orders/${id}`;
    case "GOODS_RECEIPT_NOTE":
      return `/app/goods-receipt-notes/${id}`;
    case "PURCHASE_INVOICE":
      return `/app/purchase-invoices/${id}`;
    case "PURCHASE_RETURN":
      return `/app/purchase-returns/${id}`;
  }
};

export function OverviewPage() {
  const navigate = useNavigate();
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);

  const [overview, setOverview] = useState<PurchaseOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;
    setLoading(true);
    try {
      setOverview(await getPurchaseOverview());
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to load purchase overview");
    } finally {
      setLoading(false);
    }
  }, [activeStore, isBusinessSelected]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = overview
    ? [
        {
          label: "Invoice Purchases Today",
          value: formatCurrency(overview.kpis.todayPurchaseAmount),
          title: "posted purchase invoices for today",
        },
        {
          label: "Invoices Today",
          value: overview.kpis.todayPurchaseDocumentCount,
          title: "posted purchase invoices for today",
        },
        {
          label: "Open Orders",
          value: overview.kpis.openOrderCount,
          title: "purchase orders pending receipt",
        },
        {
          label: "Pending Goods Receipts",
          value: overview.kpis.pendingGoodsReceiptCount,
          title: "goods receipts pending invoice completion",
        },
        {
          label: "Goods Receipts Today",
          value: overview.kpis.todayGoodsReceiptCount,
          title: "goods receipts posted today",
        },
      ]
    : [
        { label: "Invoice Purchases Today", value: "-", title: "posted purchase invoices for today" },
        { label: "Invoices Today", value: "-", title: "posted purchase invoices for today" },
        { label: "Open Orders", value: "-", title: "purchase orders pending receipt" },
        { label: "Pending Goods Receipts", value: "-", title: "goods receipts pending invoice completion" },
        { label: "Goods Receipts Today", value: "-", title: "goods receipts posted today" },
      ];

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <CardTitle>Purchases Overview</CardTitle>
              <CardDescription>
                Monitor supplier orders, receiving, invoices, and return activity.
                {overview?.generatedAt ? (
                  <span className="ml-2 border-l border-border/80 pl-2 text-[10px]">
                    Last updated: {formatTime(overview.generatedAt)}
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              title={metric.title}
              className="min-w-0 rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2"
            >
              <p className="truncate text-[10px] text-muted-foreground">{metric.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{metric.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2 text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <p className="text-xs">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Needs Attention</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              <div className="space-y-2 lg:hidden">
                {!overview?.needsAttention.length && !loading && !error ? (
                  <p className="p-2 text-xs text-muted-foreground">No purchase items need attention.</p>
                ) : null}
                {(overview?.needsAttention ?? []).map((row) => (
                  <div
                    key={row.id}
                    className="cursor-pointer rounded-lg border border-border/80 bg-muted/40 px-3 py-2 transition hover:bg-muted/60"
                    onClick={() => navigate(getDocumentRoute(row.documentType, row.id))}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {documentTypeLabel[row.documentType]} {row.documentNo}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{row.supplierName}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(row.amount)}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-destructive">
                        {row.reasonLabel} <span className="ml-1 font-normal text-muted-foreground">- {row.status}</span>
                      </span>
                      <span className="text-muted-foreground">{formatDateTime(row.dueDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
                  <TabularHeader>
                    <TabularRow columns={withTabularSerialNumberColumn("minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,1.5fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,0.8fr)")}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Type</TabularCell>
                      <TabularCell variant="header">Document No</TabularCell>
                      <TabularCell variant="header">Supplier</TabularCell>
                      <TabularCell variant="header">Reason</TabularCell>
                      <TabularCell variant="header">Status</TabularCell>
                      <TabularCell variant="header" align="end">Amount</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {!overview?.needsAttention.length && !loading && !error ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">No purchase items need attention.</div>
                    ) : null}
                    {(overview?.needsAttention ?? []).map((row, index) => (
                      <TabularRow
                        key={row.id}
                        columns={withTabularSerialNumberColumn("minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,1.5fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,0.8fr)")}
                        interactive
                        className="cursor-pointer"
                        onClick={() => navigate(getDocumentRoute(row.documentType, row.id))}
                      >
                        <TabularSerialNumberCell index={index} />
                        <TabularCell>{documentTypeLabel[row.documentType]}</TabularCell>
                        <TabularCell>{row.documentNo}</TabularCell>
                        <TabularCell>{row.supplierName}</TabularCell>
                        <TabularCell className="font-medium text-destructive">{row.reasonLabel}</TabularCell>
                        <TabularCell>{row.status}</TabularCell>
                        <TabularCell align="end">{formatCurrency(row.amount)}</TabularCell>
                      </TabularRow>
                    ))}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Purchase Activity</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              <div className="space-y-2 lg:hidden">
                {!overview?.recentActivity.length && !loading && !error ? (
                  <p className="p-2 text-xs text-muted-foreground">No recent purchase activity.</p>
                ) : null}
                {(overview?.recentActivity ?? []).map((row) => (
                  <div
                    key={row.id}
                    className="cursor-pointer rounded-lg border border-border/80 bg-muted/40 px-3 py-2 transition hover:bg-muted/60"
                    onClick={() => navigate(getDocumentRoute(row.documentType, row.id))}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.documentNo}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{row.supplierName}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(row.amount)}</p>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{row.status}</span>
                      <span>{formatTime(row.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
                  <TabularHeader>
                    <TabularRow columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.75fr)")}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Type</TabularCell>
                      <TabularCell variant="header">Document No</TabularCell>
                      <TabularCell variant="header">Supplier</TabularCell>
                      <TabularCell variant="header">Doc Date</TabularCell>
                      <TabularCell variant="header">Status</TabularCell>
                      <TabularCell variant="header" align="end">Amount</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {!overview?.recentActivity.length && !loading && !error ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">No recent purchase activity.</div>
                    ) : null}
                    {(overview?.recentActivity ?? []).map((row, index) => (
                      <TabularRow
                        key={row.id}
                        columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.75fr)")}
                        interactive
                        className="cursor-pointer"
                        onClick={() => navigate(getDocumentRoute(row.documentType, row.id))}
                      >
                        <TabularSerialNumberCell index={index} />
                        <TabularCell>{documentTypeLabel[row.documentType]}</TabularCell>
                        <TabularCell>{row.documentNo}</TabularCell>
                        <TabularCell>{row.supplierName}</TabularCell>
                        <TabularCell>{formatDateTime(row.documentDate)}</TabularCell>
                        <TabularCell>{row.status}</TabularCell>
                        <TabularCell align="end">{formatCurrency(row.amount)}</TabularCell>
                      </TabularRow>
                    ))}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[auto_1fr_1fr]">
          <Card className="border-primary/20 bg-primary/5 p-2">
            <CardContent className="p-2">
              <p className="mb-1 text-xs font-medium text-primary">Purchase Workflow</p>
              <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 text-[10px] text-muted-foreground">
                <span>Purchase Order</span>
                <span className="shrink-0 text-primary/50">-&gt;</span>
                <span>Goods Receipt</span>
                <span className="shrink-0 text-primary/50">-&gt;</span>
                <span>Purchase Invoice</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Returns follow from posted receipts or invoices when goods are sent back to suppliers.
              </p>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col p-2">
            <CardHeader className="shrink-0 pb-2">
              <CardTitle className="text-sm">Create</CardTitle>
            </CardHeader>
            <CardContent className="grid flex-1 grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(action.route)}
                  className="block h-auto w-full rounded-lg border border-border/80 bg-muted/55 p-0 transition hover:border-primary/35 hover:bg-muted"
                >
                  <div className="flex w-full items-center px-2.5 py-1.5 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <action.Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate font-medium">{action.label}</span>
                    </span>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col p-2">
            <CardHeader className="shrink-0 pb-2">
              <CardTitle className="text-sm">Review</CardTitle>
            </CardHeader>
            <CardContent className="grid flex-1 grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {reviewActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(action.route)}
                  className="block h-auto w-full rounded-lg border border-border/80 bg-muted/55 p-0 transition hover:border-primary/35 hover:bg-muted"
                >
                  <div className="flex w-full items-center px-2.5 py-1.5 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <action.Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate font-medium">{action.label}</span>
                    </span>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
