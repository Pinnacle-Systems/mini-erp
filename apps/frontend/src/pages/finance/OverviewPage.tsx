import { useEffect, useState } from "react";
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
import { Button } from "../../design-system/atoms/Button";
import { useSessionStore } from "../../features/auth/session-business";
import { getFinancialOverview, type FinancialOverview } from "./financial-api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function OverviewPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [overview, setOverview] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!activeStore || !isBusinessSelected) return;
    setLoading(true);
    try {
      setOverview(await getFinancialOverview(activeStore));
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to load financial overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [activeStore, isBusinessSelected]);

  const metrics = overview
    ? [
        { label: "Customer Receivable", value: formatCurrency(overview.receivableTotal) },
        { label: "Supplier Payable", value: formatCurrency(overview.payableTotal) },
        { label: "Vendor Credit", value: formatCurrency(overview.vendorCreditTotal) },
        { label: "This Month In", value: formatCurrency(overview.thisMonthInflow) },
        { label: "This Month Out", value: formatCurrency(overview.thisMonthOutflow) },
        { label: "Expense Total", value: formatCurrency(overview.thisMonthExpenseTotal) },
      ]
    : [];

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <CardTitle>Financial Overview</CardTitle>
              <CardDescription>
                Monitor outstanding balances, recent money movement, and business spending.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-border/80 bg-muted/55 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{metric.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="min-h-0 p-2 lg:flex lg:flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 lg:flex-1">
            <TabularSurface className="min-h-0 overflow-hidden">
              <TabularHeader>
                <TabularRow columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.75fr)")}>
                  <TabularSerialNumberHeaderCell />
                  <TabularCell variant="header">When</TabularCell>
                  <TabularCell variant="header">Source</TabularCell>
                  <TabularCell variant="header">Account</TabularCell>
                  <TabularCell variant="header" align="end">Amount</TabularCell>
                </TabularRow>
              </TabularHeader>
              <TabularBody className="overflow-y-auto">
                {(overview?.recentMovements ?? []).map((row, index) => (
                  <TabularRow key={row.id} columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.75fr)")}>
                    <TabularSerialNumberCell index={index} />
                    <TabularCell>{formatDateTime(row.occurredAt)}</TabularCell>
                    <TabularCell>{row.sourceDocumentNumber || row.sourceKind}</TabularCell>
                    <TabularCell>{row.accountName}</TabularCell>
                    <TabularCell align="end" className={row.direction === "INFLOW" ? "text-foreground" : "text-destructive"}>
                      {row.direction === "INFLOW" ? "+" : "-"}{formatCurrency(row.amount)}
                    </TabularCell>
                  </TabularRow>
                ))}
              </TabularBody>
            </TabularSurface>
          </CardContent>
        </Card>

        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-2">
          <Card className="p-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Account Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(overview?.accountBalances ?? []).map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs">
                  <span>{account.name}</span>
                  <span className="font-semibold text-foreground">{formatCurrency(account.currentBalance)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="p-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Expense by Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(overview?.expenseByCategory ?? []).slice(0, 6).map((entry) => (
                <div key={entry.categoryId} className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs">
                  <span>{entry.categoryName}</span>
                  <span className="font-semibold text-foreground">{formatCurrency(entry.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
