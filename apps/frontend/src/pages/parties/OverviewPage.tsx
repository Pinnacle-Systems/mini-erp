import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  getLocalCustomers,
  getLocalSuppliers,
  syncOnce,
  type CustomerRow,
  type SupplierRow,
} from "../../features/sync/engine";
import { useConnectivity } from "../../hooks/useConnectivity";
import {
  getFinancialOverview,
  listPartyBalances,
  type FinancialOverview,
  type MoneyMovementRow,
  type PartyBalanceRow,
} from "../finance/financial-api";
import { toUserPartyErrorMessage } from "./customer-utils";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const toUserPartiesOverviewErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "Unable to load parties overview right now.";
  }
  return error.message || toUserPartyErrorMessage(error, "customer", "party");
};

const isActiveParty = (party: CustomerRow | SupplierRow) => party.isActive && !party.deletedAt;

const getNetAmount = (row: PartyBalanceRow) =>
  row.receivableOutstanding - row.customerCreditAmount - row.payableOutstanding + row.vendorCreditAmount;

const summarizeRecentPartyPayments = (overview: FinancialOverview | null) =>
  (overview?.recentMovements ?? [])
    .filter(
      (movement) =>
        movement.partyId &&
        movement.status === "POSTED" &&
        (movement.sourceKind === "PAYMENT_RECEIVED" || movement.sourceKind === "PAYMENT_MADE"),
    )
    .slice(0, 6);

export function OverviewPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [balances, setBalances] = useState<PartyBalanceRow[]>([]);
  const [financialOverview, setFinancialOverview] = useState<FinancialOverview | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOnline, classifyError } = useConnectivity();

  const load = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;

    setLoading(true);
    try {
      const [localCustomers, localSuppliers] = await Promise.all([
        getLocalCustomers(activeStore),
        getLocalSuppliers(activeStore),
      ]);
      setCustomers(localCustomers);
      setSuppliers(localSuppliers);

      if (isOnline) {
        await syncOnce(activeStore);
        const [syncedCustomers, syncedSuppliers] = await Promise.all([
          getLocalCustomers(activeStore),
          getLocalSuppliers(activeStore),
        ]);
        setCustomers(syncedCustomers);
        setSuppliers(syncedSuppliers);
      }

      const [nextBalances, nextFinancialOverview] = await Promise.all([
        listPartyBalances(activeStore),
        getFinancialOverview(activeStore),
      ]);
      setBalances(nextBalances);
      setFinancialOverview(nextFinancialOverview);
      setLastUpdatedAt(new Date().toISOString());
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(
        classifyError(nextError).isConnectivityError
          ? "Showing local party records. Receivable and payable breakup will refresh when the connection recovers."
          : toUserPartiesOverviewErrorMessage(nextError),
      );
    } finally {
      setLoading(false);
    }
  }, [activeStore, classifyError, isBusinessSelected, isOnline]);

  useEffect(() => {
    void load();
  }, [load]);

  const overview = useMemo(() => {
    const activeCustomers = customers.filter(isActiveParty);
    const activeSuppliers = suppliers.filter(isActiveParty);
    const supplierIds = new Set(activeSuppliers.map((supplier) => supplier.entityId));
    const sharedPartyIds = new Set(
      activeCustomers
        .filter((customer) => supplierIds.has(customer.entityId))
        .map((customer) => customer.entityId),
    );
    const receivableRows = balances
      .filter((row) => row.receivableOutstanding > 0 || row.customerCreditAmount > 0)
      .sort(
        (left, right) =>
          right.receivableOutstanding +
          right.customerCreditAmount -
          (left.receivableOutstanding + left.customerCreditAmount),
      );
    const payableRows = balances
      .filter((row) => row.payableOutstanding > 0 || row.vendorCreditAmount > 0)
      .sort(
        (left, right) =>
          right.payableOutstanding +
          right.vendorCreditAmount -
          (left.payableOutstanding + left.vendorCreditAmount),
      );
    const sharedRows = balances
      .filter((row) => sharedPartyIds.has(row.partyId))
      .sort((left, right) => Math.abs(getNetAmount(right)) - Math.abs(getNetAmount(left)));
    const recentPayments = summarizeRecentPartyPayments(financialOverview);
    const receivableTotal = balances.reduce((sum, row) => sum + row.receivableOutstanding, 0);
    const payableTotal = balances.reduce((sum, row) => sum + row.payableOutstanding, 0);
    const netPartyPosition = balances.reduce((sum, row) => sum + getNetAmount(row), 0);

    return {
      activeCustomers,
      activeSuppliers,
      sharedPartyIds,
      receivableRows,
      payableRows,
      sharedRows,
      recentPayments,
      receivableTotal,
      payableTotal,
      netPartyPosition,
    };
  }, [balances, customers, financialOverview, suppliers]);

  const metrics = [
    { label: "Active Customers", value: overview.activeCustomers.length },
    { label: "Active Suppliers", value: overview.activeSuppliers.length },
    { label: "Shared Parties", value: overview.sharedPartyIds.size },
    { label: "Customer Receivable", value: formatCurrency(overview.receivableTotal) },
    { label: "Supplier Payable", value: formatCurrency(overview.payableTotal) },
    { label: "Net Party Position", value: formatCurrency(overview.netPartyPosition) },
  ];

  const balanceGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1.55fr) minmax(76px,0.45fr) minmax(64px,0.5fr) minmax(0,0.9fr) minmax(0,0.85fr)",
  );
  const paymentGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,0.9fr)",
  );

  const renderPartyBalanceTable = (
    rows: PartyBalanceRow[],
    amountKey: "receivableOutstanding" | "payableOutstanding",
    emptyMessage: string,
  ) => (
    <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
      <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
        <TabularHeader>
          <TabularRow columns={balanceGridTemplate}>
            <TabularSerialNumberHeaderCell />
            <TabularCell variant="header">Party</TabularCell>
            <TabularCell variant="header" align="end">
              Open Docs
            </TabularCell>
            <TabularCell variant="header" align="end">
              Credit
            </TabularCell>
            <TabularCell variant="header">Last Activity</TabularCell>
            <TabularCell variant="header" align="end">
              Amount
            </TabularCell>
          </TabularRow>
        </TabularHeader>
        <TabularBody className="overflow-y-auto">
          {rows.length === 0 && !loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">{emptyMessage}</div>
          ) : null}
          {rows.slice(0, 10).map((row, index) => (
            <TabularRow key={`${amountKey}:${row.partyId}`} columns={balanceGridTemplate} interactive>
              <TabularSerialNumberCell index={index} />
              <TabularCell truncate hoverTitle={row.partyName}>
                {row.partyName}
              </TabularCell>
              <TabularCell align="end">
                {amountKey === "receivableOutstanding"
                  ? row.receivableDocumentCount
                  : row.payableDocumentCount}
              </TabularCell>
              <TabularCell align="end">
                {formatCurrency(
                  amountKey === "receivableOutstanding"
                    ? row.customerCreditAmount
                    : row.vendorCreditAmount,
                )}
              </TabularCell>
              <TabularCell truncate hoverTitle={formatDateTime(row.lastActivityAt)}>
                {formatDateTime(row.lastActivityAt)}
              </TabularCell>
              <TabularCell align="end" className="font-semibold text-foreground">
                {formatCurrency(row[amountKey])}
              </TabularCell>
            </TabularRow>
          ))}
        </TabularBody>
      </TabularSurface>
    </div>
  );

  const renderMobileBalanceRows = (
    rows: PartyBalanceRow[],
    amountKey: "receivableOutstanding" | "payableOutstanding",
    emptyMessage: string,
  ) => (
    <div className="space-y-2 lg:hidden">
      {rows.length === 0 && !loading ? (
        <p className="p-2 text-xs text-muted-foreground">{emptyMessage}</p>
      ) : null}
      {rows.slice(0, 10).map((row) => (
        <div key={`${amountKey}:mobile:${row.partyId}`} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.partyName}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {amountKey === "receivableOutstanding" ? row.receivableDocumentCount : row.payableDocumentCount} open docs
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(row[amountKey])}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Last activity: {formatDateTime(row.lastActivityAt)}
          </p>
        </div>
      ))}
    </div>
  );

  const renderPaymentRows = (rows: MoneyMovementRow[]) => (
    <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
      <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
        <TabularHeader>
          <TabularRow columns={paymentGridTemplate}>
            <TabularSerialNumberHeaderCell />
            <TabularCell variant="header">When</TabularCell>
            <TabularCell variant="header">Party</TabularCell>
            <TabularCell variant="header">Type</TabularCell>
            <TabularCell variant="header">Account</TabularCell>
            <TabularCell variant="header" align="end">
              Amount
            </TabularCell>
          </TabularRow>
        </TabularHeader>
        <TabularBody className="overflow-y-auto">
          {rows.length === 0 && !loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No recent party payments.</div>
          ) : null}
          {rows.map((row, index) => (
            <TabularRow key={row.id} columns={paymentGridTemplate} interactive>
              <TabularSerialNumberCell index={index} />
              <TabularCell truncate hoverTitle={formatDateTime(row.occurredAt)}>
                {formatDateTime(row.occurredAt)}
              </TabularCell>
              <TabularCell truncate hoverTitle={row.partyName || "No party"}>
                {row.partyName || "No party"}
              </TabularCell>
              <TabularCell>
                {row.sourceKind === "PAYMENT_RECEIVED" ? "Received" : "Made"}
              </TabularCell>
              <TabularCell truncate hoverTitle={row.accountName}>
                {row.accountName}
              </TabularCell>
              <TabularCell
                align="end"
                className={row.direction === "INFLOW" ? "font-semibold text-foreground" : "font-semibold text-destructive"}
              >
                {row.direction === "INFLOW" ? "+" : "-"}
                {formatCurrency(row.amount)}
              </TabularCell>
            </TabularRow>
          ))}
        </TabularBody>
      </TabularSurface>
    </div>
  );

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <CardTitle>Parties Overview</CardTitle>
              <CardDescription>
                Monitor customer and supplier relationships, balances, and recent party payments.
                {lastUpdatedAt ? (
                  <span className="ml-2 border-l border-border/80 pl-2 text-[10px]">
                    Last updated: {formatDateTime(lastUpdatedAt)}
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {metrics.map((metric) => (
            <div
              key={metric.label}
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

      <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-2">
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Customer Receivables</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              {renderMobileBalanceRows(
                overview.receivableRows,
                "receivableOutstanding",
                "No open customer receivables.",
              )}
              {renderPartyBalanceTable(
                overview.receivableRows,
                "receivableOutstanding",
                "No open customer receivables.",
              )}
            </CardContent>
          </Card>

          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Supplier Payables</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              {renderMobileBalanceRows(
                overview.payableRows,
                "payableOutstanding",
                "No open supplier payables.",
              )}
              {renderPartyBalanceTable(
                overview.payableRows,
                "payableOutstanding",
                "No open supplier payables.",
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-2">
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Shared Party Net Position</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 space-y-2 overflow-y-auto">
              {overview.sharedRows.length === 0 && !loading ? (
                <p className="p-2 text-xs text-muted-foreground">No shared parties currently have balances.</p>
              ) : null}
              {overview.sharedRows.slice(0, 8).map((row) => {
                const netAmount = getNetAmount(row);
                return (
                  <div
                    key={row.partyId}
                    className="rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium text-foreground">{row.partyName}</span>
                      <span className={netAmount < 0 ? "font-semibold text-destructive" : "font-semibold text-foreground"}>
                        {formatCurrency(netAmount)}
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>Receivable {formatCurrency(row.receivableOutstanding)}</span>
                      <span className="text-right">Payable {formatCurrency(row.payableOutstanding)}</span>
                      <span>Customer credit {formatCurrency(row.customerCreditAmount)}</span>
                      <span className="text-right">Vendor credit {formatCurrency(row.vendorCreditAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Party Payments</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              <div className="space-y-2 lg:hidden">
                {overview.recentPayments.length === 0 && !loading ? (
                  <p className="p-2 text-xs text-muted-foreground">No recent party payments.</p>
                ) : null}
                {overview.recentPayments.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.partyName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDateTime(row.occurredAt)} - {row.accountName}
                        </p>
                      </div>
                      <p className={row.direction === "INFLOW" ? "text-sm font-semibold text-foreground" : "text-sm font-semibold text-destructive"}>
                        {row.direction === "INFLOW" ? "+" : "-"}
                        {formatCurrency(row.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {renderPaymentRows(overview.recentPayments)}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
