import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../design-system/atoms/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import {
  getPartyFinancialSummary,
  type PartyFinancialSummary,
} from "../finance/financial-api";
import {
  hasAssignedStoreCapability,
  useSessionStore,
} from "../../features/auth/session-business";
import {
  getLocalCustomers,
  getLocalSuppliers,
  queueCustomerDelete,
  queueSupplierDelete,
  queueSupplierCreate,
  queueCustomerUpdate,
  syncOnce,
  type CustomerRow,
} from "../../features/sync/engine";
import { CustomerFormFields } from "./customer-form";
import {
  EMPTY_CUSTOMER_DRAFT,
  toCustomerDraft,
  toUserCustomerErrorMessage,
} from "./customer-utils";

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

export function CustomerDetailsPage() {
  const navigate = useNavigate();
  const { customerId = "" } = useParams();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [isAlsoSupplier, setIsAlsoSupplier] = useState(false);
  const [alsoManageAsSupplier, setAlsoManageAsSupplier] = useState(false);
  const [draft, setDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [initialDraft, setInitialDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [financialSummary, setFinancialSummary] = useState<PartyFinancialSummary | null>(null);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;
  const canAlsoBeSupplier = hasAssignedStoreCapability(activeBusiness, "PARTIES_SUPPLIERS");
  const hasAccountsModule = useSessionStore((state) => state.activeBusinessModules?.accounts ?? false);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected || !customerId) {
      setCustomer(null);
      setIsAlsoSupplier(false);
      setAlsoManageAsSupplier(false);
      setDraft(EMPTY_CUSTOMER_DRAFT);
      setInitialDraft(EMPTY_CUSTOMER_DRAFT);
      setHasLoaded(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [localRows, localSuppliers] = await Promise.all([
          getLocalCustomers(activeStore),
          getLocalSuppliers(activeStore),
        ]);
        const localCustomer =
          localRows.find((row) => row.entityId === customerId) ?? null;
        const localSupplierExists = localSuppliers.some((row) => row.entityId === customerId);
        if (!cancelled) {
          setCustomer(localCustomer);
          setIsAlsoSupplier(localSupplierExists);
          setAlsoManageAsSupplier(localSupplierExists);
          const nextDraft = localCustomer
            ? toCustomerDraft(localCustomer)
            : EMPTY_CUSTOMER_DRAFT;
          setDraft(nextDraft);
          setInitialDraft(nextDraft);
          setSaveError(null);
        }

        await syncOnce(activeStore);
        const [syncedRows, syncedSuppliers] = await Promise.all([
          getLocalCustomers(activeStore),
          getLocalSuppliers(activeStore),
        ]);
        const syncedCustomer =
          syncedRows.find((row) => row.entityId === customerId) ?? null;
        const syncedSupplierExists = syncedSuppliers.some((row) => row.entityId === customerId);
        if (!cancelled) {
          setCustomer(syncedCustomer);
          setIsAlsoSupplier(syncedSupplierExists);
          setAlsoManageAsSupplier(syncedSupplierExists);
          const nextDraft = syncedCustomer
            ? toCustomerDraft(syncedCustomer)
            : EMPTY_CUSTOMER_DRAFT;
          setDraft(nextDraft);
          setInitialDraft(nextDraft);
          setHasLoaded(true);
        }
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setSaveError(toUserCustomerErrorMessage(nextError));
          setHasLoaded(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeStore, customerId, isBusinessSelected]);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected || !customerId || !hasAccountsModule) {
      setFinancialSummary(null);
      setFinancialError(null);
      return;
    }

    let cancelled = false;

    const loadFinancialSummary = async () => {
      try {
        const summary = await getPartyFinancialSummary(activeStore, customerId, "RECEIVABLE");
        if (!cancelled) {
          setFinancialSummary(summary);
          setFinancialError(null);
        }
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setFinancialError(
            nextError instanceof Error ? nextError.message : "Unable to load customer finance summary",
          );
        }
      }
    };

    void loadFinancialSummary();

    return () => {
      cancelled = true;
    };
  }, [activeStore, customerId, hasAccountsModule, isBusinessSelected]);

  const isDirty = useMemo(
    () =>
      JSON.stringify(draft) !== JSON.stringify(initialDraft) ||
      alsoManageAsSupplier !== isAlsoSupplier,
    [alsoManageAsSupplier, draft, initialDraft, isAlsoSupplier],
  );

  const onSave = async () => {
    if (!customer || !activeStore || !identityId || !isBusinessSelected || loading) {
      return;
    }

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setSaveError("Customer name is required.");
      return;
    }

    setLoading(true);
    setSaveError(null);

    try {
      await queueCustomerUpdate(
        activeStore,
        identityId,
        customer.entityId,
        {
          ...draft,
          name: trimmedName,
        },
        customer.serverVersion,
      );
      if (alsoManageAsSupplier && canAlsoBeSupplier && !isAlsoSupplier) {
        await queueSupplierCreate(
          activeStore,
          identityId,
          {
            ...draft,
            name: trimmedName,
          },
          customer.entityId,
        );
      } else if (!alsoManageAsSupplier && isAlsoSupplier) {
        await queueSupplierDelete(activeStore, identityId, customer.entityId);
      }
      await syncOnce(activeStore);
      navigate("/app/customers", {
        replace: true,
        state: {
          customerMessage: isOnline()
            ? alsoManageAsSupplier && canAlsoBeSupplier && !isAlsoSupplier
              ? "Customer updated and added to suppliers."
              : !alsoManageAsSupplier && isAlsoSupplier
                ? "Customer updated and removed from suppliers."
                : "Customer updated."
            : alsoManageAsSupplier && canAlsoBeSupplier && !isAlsoSupplier
              ? "Customer and supplier updates queued offline and will sync automatically."
              : !alsoManageAsSupplier && isAlsoSupplier
                ? "Customer update and supplier removal queued offline and will sync automatically."
                : "Customer update queued offline and will sync automatically.",
        },
      });
    } catch (nextError) {
      console.error(nextError);
      setSaveError(toUserCustomerErrorMessage(nextError));
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!customer || !activeStore || !identityId || !isBusinessSelected || loading) {
      return;
    }

    const confirmed = window.confirm(
      isAlsoSupplier
        ? `Delete '${customer.name}'? This will delete the shared party from both customers and suppliers. To keep it as only a supplier, clear the supplier checkbox and save instead.`
        : `Delete '${customer.name}'? This will mark the customer inactive.`,
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setSaveError(null);

    try {
      await queueCustomerDelete(activeStore, identityId, customer.entityId);
      await syncOnce(activeStore);
      navigate("/app/customers", {
        replace: true,
        state: {
          customerMessage: isOnline()
            ? isAlsoSupplier
              ? "Party deleted from customers and suppliers."
              : "Customer deleted."
            : isAlsoSupplier
              ? "Party delete queued offline and will remove it from customers and suppliers after sync."
              : "Customer delete queued offline and will sync automatically.",
        },
      });
    } catch (nextError) {
      console.error(nextError);
      setSaveError(toUserCustomerErrorMessage(nextError));
      setLoading(false);
    }
  };

  if (!customer && hasLoaded && !loading) {
    return (
      <Card className="lg:h-full lg:min-h-0">
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>
            This customer is no longer available. Return to the customer table and
            select another record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/app/customers")}
          >
            Back to Customers
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>{customer?.name || "Customer Details"}</CardTitle>
        <CardDescription>
          Review and update the selected customer record in its own detail page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 lg:max-w-3xl">
        {saveError ? <p className="text-xs text-red-700">{saveError}</p> : null}
        {customer ? (
          <>
            {hasAccountsModule ? (
              <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Financial Summary</p>
                    <p className="text-[11px] text-muted-foreground">
                      Customer receivables, unapplied credit, and recent payment activity.
                    </p>
                  </div>
                </div>
                {financialError ? (
                  <p className="text-xs text-destructive">{financialError}</p>
                ) : financialSummary ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-4">
                      <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Total Outstanding</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatCurrency(financialSummary.totalOutstanding)}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Open Invoices</div>
                        <div className="text-sm font-semibold text-foreground">
                          {financialSummary.openDocumentCount}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Unapplied Credit</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatCurrency(financialSummary.unappliedAmount)}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Customer Credit</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatCurrency(financialSummary.documentCreditAmount)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground">Recent Finance Activity</p>
                      {financialSummary.recentMovements.length > 0 ? (
                        financialSummary.recentMovements.map((movement) => (
                          <div
                            key={movement.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">
                                {movement.sourceDocumentNumber || movement.referenceNo || "Payment"}
                              </div>
                              <div className="truncate text-muted-foreground">
                                {new Date(movement.occurredAt).toLocaleDateString()} • {movement.accountName}
                              </div>
                            </div>
                            <div className="shrink-0 font-semibold text-foreground">
                              {formatCurrency(movement.amount)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No payment activity recorded yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading financial summary...</p>
                )}
              </div>
            ) : null}
            <CustomerFormFields
              draft={draft}
              setDraft={setDraft}
              disabled={loading}
              fieldIdPrefix="details"
              secondaryRoleLabel={canAlsoBeSupplier ? "Supplier" : undefined}
              secondaryRoleChecked={alsoManageAsSupplier}
              onSecondaryRoleChange={setAlsoManageAsSupplier}
              secondaryRoleHint={
                canAlsoBeSupplier
                  ? isAlsoSupplier
                    ? "Clear this to keep the party only as a customer."
                    : "Add this shared party record to the supplier list too."
                  : undefined
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  void onSave();
                }}
                disabled={
                  !activeStore ||
                  !isBusinessSelected ||
                  !identityId ||
                  loading ||
                  !isDirty
                }
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(initialDraft);
                  setAlsoManageAsSupplier(isAlsoSupplier);
                }}
                disabled={loading || !isDirty}
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app/customers")}
                disabled={loading}
              >
                Back to Customers
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => {
                  void onDelete();
                }}
                disabled={loading}
              >
                Delete Customer
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Loading customer...</p>
        )}
      </CardContent>
    </Card>
  );
}
