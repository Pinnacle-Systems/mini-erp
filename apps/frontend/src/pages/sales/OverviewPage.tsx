import { ClipboardList, FileText, HandCoins, ReceiptText, ScanBarcode, Undo2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
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
import { getSalesOverview, type SalesOverview } from "./sales-documents-api";

const quickActions = [
  { label: "Open POS", route: "/app/sales-pos", Icon: ScanBarcode },
  { label: "New Invoice", route: "/app/sales-bills/new", Icon: HandCoins },
  { label: "New Estimate", route: "/app/sales-estimates/new", Icon: ClipboardList },
  { label: "New Order", route: "/app/sales-orders/new", Icon: FileText },
];

const reviewActions = [
  { label: "Estimates", route: "/app/sales-estimates", Icon: ClipboardList },
  { label: "Orders", route: "/app/sales-orders", Icon: FileText },
  { label: "Invoices", route: "/app/sales-bills", Icon: HandCoins },
  { label: "Delivery Challans", route: "/app/delivery-challans", Icon: ReceiptText },
  { label: "Returns", route: "/app/sales-returns", Icon: Undo2 },
];

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

const documentTypeLabel: Record<string, string> = {
  SALES_ESTIMATE: "Estimate",
  SALES_ORDER: "Order",
  DELIVERY_CHALLAN: "Delivery Challan",
  SALES_INVOICE: "Invoice",
  SALES_RETURN: "Return"
};

const getDocumentRoute = (documentType: string, id: string) => {
  switch (documentType) {
    case "SALES_ESTIMATE": return `/app/sales-estimates/${id}`;
    case "SALES_ORDER": return `/app/sales-orders/${id}`;
    case "SALES_INVOICE": return `/app/sales-bills/${id}`;
    case "DELIVERY_CHALLAN": return `/app/delivery-challans/${id}`;
    case "SALES_RETURN": return `/app/sales-returns/${id}`;
    default: return undefined;
  }
};

export function OverviewPage() {
  const navigate = useNavigate();
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  
  const [overview, setOverview] = useState<SalesOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;
    setLoading(true);
    try {
      setOverview(await getSalesOverview());
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to load sales overview");
    } finally {
      setLoading(false);
    }
  }, [activeStore, isBusinessSelected]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = overview
    ? [
        { label: "Invoice Sales Today", value: formatCurrency(overview.kpis.todaySalesAmount), title: "completed/posted invoices for today" },
        { label: "Invoices Today", value: overview.kpis.todaySalesDocumentCount, title: "completed/posted invoices for today" },
        { label: "Open Estimates", value: overview.kpis.openEstimateCount, title: "estimates pending action" },
        { label: "Pending Orders", value: overview.kpis.pendingOrderCount, title: "orders pending delivery" },
        { label: "Delivery Challans Today", value: overview.kpis.todayDeliveryCount, title: "delivery challans created/posted today" },
      ]
    : [
        { label: "Invoice Sales Today", value: "-", title: "completed/posted invoices for today" },
        { label: "Invoices Today", value: "-", title: "completed/posted invoices for today" },
        { label: "Open Estimates", value: "-", title: "estimates pending action" },
        { label: "Pending Orders", value: "-", title: "orders pending delivery" },
        { label: "Delivery Challans Today", value: "-", title: "delivery challans created/posted today" },
    ];

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>
                Monitor daily sales, pending orders, and action items.
                {overview?.generatedAt ? <span className="ml-2 border-l pl-2 border-border/80 text-[10px]">Last updated: {formatTime(overview.generatedAt)}</span> : null}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
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
        <div className="rounded-md bg-destructive/10 p-2 border border-destructive/20 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-xs">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Needs Attention</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex-1 lg:flex lg:flex-col">
              <div className="space-y-2 lg:hidden">
                {!overview?.needsAttention.length && !loading && !error && (
                    <p className="text-xs text-muted-foreground p-2">No pending items need attention.</p>
                )}
                {(overview?.needsAttention ?? []).map((row) => {
                  const route = getDocumentRoute(row.documentType, row.id);
                  return (
                    <div 
                      key={row.id} 
                      className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 cursor-pointer transition hover:bg-muted/60"
                      onClick={() => { if (route) navigate(route); }}
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {documentTypeLabel[row.documentType] || row.documentType} {row.documentNo}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.customerName}
                        </p>
                      </div>
                      <p className={`text-sm font-semibold text-foreground`}>
                        {formatCurrency(row.amount)}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-destructive font-medium">{row.reasonLabel} <span className="text-muted-foreground ml-1 font-normal">• {row.status}</span></span>
                        <span className="text-muted-foreground">{formatDateTime(row.dueDate)}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
                  <TabularHeader>
                    <TabularRow columns={withTabularSerialNumberColumn("minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.5fr) minmax(0,0.6fr) minmax(0,1fr) minmax(0,0.8fr)")}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Type</TabularCell>
                      <TabularCell variant="header">Document No</TabularCell>
                      <TabularCell variant="header">Customer</TabularCell>
                      <TabularCell variant="header">Reason</TabularCell>
                      <TabularCell variant="header">Status</TabularCell>
                      <TabularCell variant="header">Due Date</TabularCell>
                      <TabularCell variant="header" align="end">Amount</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {!overview?.needsAttention.length && !loading && !error && (
                        <div className="p-4 text-center text-xs text-muted-foreground">No pending items need attention.</div>
                    )}
                    {(overview?.needsAttention ?? []).map((row, index) => {
                      const route = getDocumentRoute(row.documentType, row.id);
                      return (
                        <TabularRow 
                          key={row.id} 
                          columns={withTabularSerialNumberColumn("minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.5fr) minmax(0,0.6fr) minmax(0,1fr) minmax(0,0.8fr)")}
                          interactive
                          className="cursor-pointer"
                          onClick={() => { if (route) navigate(route); }}
                        >
                        <TabularSerialNumberCell index={index} />
                        <TabularCell>{documentTypeLabel[row.documentType] || row.documentType}</TabularCell>
                        <TabularCell>{row.documentNo}</TabularCell>
                        <TabularCell>{row.customerName}</TabularCell>
                        <TabularCell className="text-destructive font-medium">{row.reasonLabel}</TabularCell>
                        <TabularCell>{row.status}</TabularCell>
                        <TabularCell>{formatDateTime(row.dueDate)}</TabularCell>
                        <TabularCell align="end">{formatCurrency(row.amount)}</TabularCell>
                      </TabularRow>
                      );
                    })}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Sales Activity</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex-1 lg:flex lg:flex-col">
              <div className="space-y-2 lg:hidden">
                 {!overview?.recentActivity.length && !loading && !error && (
                    <p className="text-xs text-muted-foreground p-2">No recent sales activity.</p>
                 )}
                {(overview?.recentActivity ?? []).map((row) => {
                  const route = getDocumentRoute(row.documentType, row.id);
                  return (
                    <div 
                      key={row.id} 
                      className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 cursor-pointer transition hover:bg-muted/60"
                      onClick={() => { if (route) navigate(route); }}
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.documentNo}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.customerName}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(row.amount)}
                      </p>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>{row.status}</span>
                        <span>{formatTime(row.updatedAt)}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
                  <TabularHeader>
                    <TabularRow columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.75fr)")}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Type</TabularCell>
                      <TabularCell variant="header">Document No</TabularCell>
                      <TabularCell variant="header">Customer</TabularCell>
                      <TabularCell variant="header">Doc Date</TabularCell>
                      <TabularCell variant="header">Status</TabularCell>
                      <TabularCell variant="header" align="end">Amount</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {!overview?.recentActivity.length && !loading && !error && (
                        <div className="p-4 text-center text-xs text-muted-foreground">No recent sales activity.</div>
                    )}
                    {(overview?.recentActivity ?? []).map((row, index) => {
                      const route = getDocumentRoute(row.documentType, row.id);
                      return (
                        <TabularRow 
                          key={row.id} 
                          columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.75fr)")}
                          interactive
                          className="cursor-pointer"
                          onClick={() => { if (route) navigate(route); }}
                        >
                        <TabularSerialNumberCell index={index} />
                        <TabularCell>{documentTypeLabel[row.documentType] || row.documentType}</TabularCell>
                        <TabularCell>{row.documentNo}</TabularCell>
                        <TabularCell>{row.customerName}</TabularCell>
                        <TabularCell>{formatDateTime(row.documentDate)}</TabularCell>
                        <TabularCell>{row.status}</TabularCell>
                        <TabularCell align="end">{formatCurrency(row.amount)}</TabularCell>
                      </TabularRow>
                      );
                    })}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[auto_1fr_1fr]">
          <Card className="p-2 border-primary/20 bg-primary/5">
             <CardContent className="p-2">
                 <p className="text-xs font-medium text-primary mb-1">Sales Workflow</p>
                 <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap overflow-x-auto pb-1">
                    <span>Estimate</span>
                    <span className="shrink-0 text-primary/50">→</span>
                    <span>Sale Order</span>
                    <span className="shrink-0 text-primary/50">→</span>
                    <span>Delivery Challan</span>
                    <span className="shrink-0 text-primary/50">→</span>
                    <span>Invoice</span>
                 </div>
                 <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                     Returns follow from completed invoices or delivered sales documents.
                 </p>
             </CardContent>
          </Card>

          <Card className="p-2 flex flex-col min-h-0">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm">Create</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1 flex-1">
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

          <Card className="p-2 flex flex-col min-h-0">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm">Review</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1 flex-1">
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
