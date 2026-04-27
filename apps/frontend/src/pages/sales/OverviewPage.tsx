import { ClipboardList, FileText, HandCoins, ReceiptText, ScanBarcode, Undo2 } from "lucide-react";
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

const summaryTiles = [
  { label: "Checkout", value: "POS", route: "/app/sales-pos" },
  { label: "Billing", value: "Invoices", route: "/app/sales-bills" },
  { label: "Pipeline", value: "Orders", route: "/app/sales-orders" },
  { label: "Quoting", value: "Estimates", route: "/app/sales-estimates" },
  { label: "Dispatch", value: "Challans", route: "/app/delivery-challans" },
  { label: "After Sales", value: "Returns", route: "/app/sales-returns" },
];

const workflows = [
  {
    label: "Estimates",
    purpose: "Prepare quotations before order confirmation.",
    route: "/app/sales-estimates",
  },
  {
    label: "Orders",
    purpose: "Track confirmed customer orders.",
    route: "/app/sales-orders",
  },
  {
    label: "Delivery Challans",
    purpose: "Review dispatch documents for customer deliveries.",
    route: "/app/delivery-challans",
  },
  {
    label: "Invoices",
    purpose: "Create and review sales invoices.",
    route: "/app/sales-bills",
  },
  {
    label: "Returns",
    purpose: "Handle customer returns and posted return records.",
    route: "/app/sales-returns",
  },
];

const quickActions = [
  { label: "Open POS", route: "/app/sales-pos", Icon: ScanBarcode },
  { label: "New Invoice", route: "/app/sales-bills/new", Icon: HandCoins },
  { label: "New Estimate", route: "/app/sales-estimates/new", Icon: ClipboardList },
  { label: "New Order", route: "/app/sales-orders/new", Icon: FileText },
];

const reviewActions = [
  { label: "Invoices", route: "/app/sales-bills", Icon: HandCoins },
  { label: "Delivery Challans", route: "/app/delivery-challans", Icon: ReceiptText },
  { label: "Returns", route: "/app/sales-returns", Icon: Undo2 },
];

export function OverviewPage() {
  const navigate = useNavigate();

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>
                Start billing, review sales documents, and move customer transactions through the sales flow.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => navigate("/app/sales-bills/new")}>
              New Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {summaryTiles.map((tile) => (
            <Button
              key={tile.label}
              type="button"
              variant="ghost"
              onClick={() => navigate(tile.route)}
              className="flex h-auto min-w-0 flex-col items-start rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2 text-left transition hover:border-primary/35 hover:bg-muted"
            >
              <p className="truncate text-[10px] text-muted-foreground">{tile.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{tile.value}</p>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="min-h-0 p-2 lg:flex lg:flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sales Workflows</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 lg:flex-1">
            <div className="space-y-2 lg:hidden">
              {workflows.map((workflow) => (
                <Button
                  key={workflow.label}
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(workflow.route)}
                  className="flex h-auto w-full flex-col items-start rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-left"
                >
                  <p className="truncate text-sm font-medium text-foreground">{workflow.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{workflow.purpose}</p>
                </Button>
              ))}
            </div>
            <div className="hidden min-h-0 lg:block">
              <TabularSurface className="min-h-0 overflow-hidden">
                <TabularHeader>
                  <TabularRow columns={withTabularSerialNumberColumn("minmax(0,0.8fr) minmax(0,1.6fr) minmax(0,0.45fr)")}>
                    <TabularSerialNumberHeaderCell />
                    <TabularCell variant="header">Workflow</TabularCell>
                    <TabularCell variant="header">Use</TabularCell>
                    <TabularCell variant="header" align="end">Open</TabularCell>
                  </TabularRow>
                </TabularHeader>
                <TabularBody className="overflow-y-auto">
                  {workflows.map((workflow, index) => (
                    <TabularRow key={workflow.label} columns={withTabularSerialNumberColumn("minmax(0,0.8fr) minmax(0,1.6fr) minmax(0,0.45fr)")}>
                      <TabularSerialNumberCell index={index} />
                      <TabularCell>{workflow.label}</TabularCell>
                      <TabularCell>{workflow.purpose}</TabularCell>
                      <TabularCell align="end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(workflow.route)}>
                          Open
                        </Button>
                      </TabularCell>
                    </TabularRow>
                  ))}
                </TabularBody>
              </TabularSurface>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-2">
          <Card className="p-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Create</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(action.route)}
                  className="flex h-auto w-full items-center justify-between rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs transition hover:border-primary/35 hover:bg-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <action.Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{action.label}</span>
                  </span>
                  <span className="font-semibold text-foreground">Open</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="p-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reviewActions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(action.route)}
                  className="flex h-auto w-full items-center justify-between rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs transition hover:border-primary/35 hover:bg-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <action.Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{action.label}</span>
                  </span>
                  <span className="font-semibold text-foreground">Open</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
