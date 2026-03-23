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
  queueCustomerCreate,
  queueCustomerDelete,
  queueSupplierDelete,
  queueSupplierUpdate,
  syncOnce,
  type SupplierRow,
} from "../../features/sync/engine";
import { CustomerFormFields } from "./customer-form";
import {
  EMPTY_CUSTOMER_DRAFT,
  toCustomerDraft,
  toUserSupplierErrorMessage,
} from "./customer-utils";

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

export function SupplierDetailsPage() {
  const navigate = useNavigate();
  const { supplierId = "" } = useParams();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [isAlsoCustomer, setIsAlsoCustomer] = useState(false);
  const [alsoManageAsCustomer, setAlsoManageAsCustomer] = useState(false);
  const [draft, setDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [initialDraft, setInitialDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [financialSummary, setFinancialSummary] = useState<PartyFinancialSummary | null>(null);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;
  const canAlsoBeCustomer = hasAssignedStoreCapability(activeBusiness, "PARTIES_CUSTOMERS");
  const hasAccountsModule = useSessionStore((state) => state.activeBusinessModules?.accounts ?? false);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected || !supplierId) {
      setSupplier(null);
      setIsAlsoCustomer(false);
      setAlsoManageAsCustomer(false);
      setDraft(EMPTY_CUSTOMER_DRAFT);
      setInitialDraft(EMPTY_CUSTOMER_DRAFT);
      setHasLoaded(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [localSuppliers, localCustomers] = await Promise.all([
          getLocalSuppliers(activeStore),
          getLocalCustomers(activeStore),
        ]);
        const localSupplier =
          localSuppliers.find((row) => row.entityId === supplierId) ?? null;
        const localCustomerExists = localCustomers.some((row) => row.entityId === supplierId);
        if (!cancelled) {
          setSupplier(localSupplier);
          setIsAlsoCustomer(localCustomerExists);
          setAlsoManageAsCustomer(localCustomerExists);
          const nextDraft = localSupplier
            ? toCustomerDraft(localSupplier)
            : EMPTY_CUSTOMER_DRAFT;
          setDraft(nextDraft);
          setInitialDraft(nextDraft);
          setSaveError(null);
        }

        await syncOnce(activeStore);
        const [syncedSuppliers, syncedCustomers] = await Promise.all([
          getLocalSuppliers(activeStore),
          getLocalCustomers(activeStore),
        ]);
        const syncedSupplier =
          syncedSuppliers.find((row) => row.entityId === supplierId) ?? null;
        const syncedCustomerExists = syncedCustomers.some((row) => row.entityId === supplierId);
        if (!cancelled) {
          setSupplier(syncedSupplier);
          setIsAlsoCustomer(syncedCustomerExists);
          setAlsoManageAsCustomer(syncedCustomerExists);
          const nextDraft = syncedSupplier
            ? toCustomerDraft(syncedSupplier)
            : EMPTY_CUSTOMER_DRAFT;
          setDraft(nextDraft);
          setInitialDraft(nextDraft);
          setHasLoaded(true);
        }
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setSaveError(toUserSupplierErrorMessage(nextError));
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
  }, [activeStore, isBusinessSelected, supplierId]);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected || !supplierId || !hasAccountsModule) {
      setFinancialSummary(null);
      setFinancialError(null);
      return;
    }

    let cancelled = false;

    const loadFinancialSummary = async () => {
      try {
        const summary = await getPartyFinancialSummary(activeStore, supplierId, "PAYABLE");
        if (!cancelled) {
          setFinancialSummary(summary);
          setFinancialError(null);
        }
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setFinancialError(
            nextError instanceof Error ? nextError.message : "Unable to load supplier finance summary",
          );
        }
      }
    };

    void loadFinancialSummary();

    return () => {
      cancelled = true;
    };
  }, [activeStore, hasAccountsModule, isBusinessSelected, supplierId]);

  const isDirty = useMemo(
    () =>
      JSON.stringify(draft) !== JSON.stringify(initialDraft) ||
      alsoManageAsCustomer !== isAlsoCustomer,
    [alsoManageAsCustomer, draft, initialDraft, isAlsoCustomer],
  );

  const onSave = async () => {
    if (!supplier || !activeStore || !identityId || !isBusinessSelected || loading) {
      return;
    }

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setSaveError("Supplier name is required.");
      return;
    }

    setLoading(true);
    setSaveError(null);

    try {
      await queueSupplierUpdate(
        activeStore,
        identityId,
        supplier.entityId,
        {
          ...draft,
          name: trimmedName,
        },
        supplier.serverVersion,
      );
      if (alsoManageAsCustomer && canAlsoBeCustomer && !isAlsoCustomer) {
        await queueCustomerCreate(
          activeStore,
          identityId,
          {
            ...draft,
            name: trimmedName,
          },
          supplier.entityId,
        );
      } else if (!alsoManageAsCustomer && isAlsoCustomer) {
        await queueCustomerDelete(activeStore, identityId, supplier.entityId);
      }
      await syncOnce(activeStore);
      navigate("/app/suppliers", {
        replace: true,
        state: {
          supplierMessage: isOnline()
            ? alsoManageAsCustomer && canAlsoBeCustomer && !isAlsoCustomer
              ? "Supplier updated and added to customers."
              : !alsoManageAsCustomer && isAlsoCustomer
                ? "Supplier updated and removed from customers."
                : "Supplier updated."
            : alsoManageAsCustomer && canAlsoBeCustomer && !isAlsoCustomer
              ? "Supplier and customer updates queued offline and will sync automatically."
              : !alsoManageAsCustomer && isAlsoCustomer
                ? "Supplier update and customer removal queued offline and will sync automatically."
                : "Supplier update queued offline and will sync automatically.",
        },
      });
    } catch (nextError) {
      console.error(nextError);
      setSaveError(toUserSupplierErrorMessage(nextError));
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!supplier || !activeStore || !identityId || !isBusinessSelected || loading) {
      return;
    }

    const confirmed = window.confirm(
      isAlsoCustomer
        ? `Delete '${supplier.name}'? This will delete the shared party from both suppliers and customers. To keep it as only a customer, clear the customer checkbox and save instead.`
        : `Delete '${supplier.name}'? This will mark the supplier inactive.`,
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setSaveError(null);

    try {
      await queueSupplierDelete(activeStore, identityId, supplier.entityId);
      await syncOnce(activeStore);
      navigate("/app/suppliers", {
        replace: true,
        state: {
          supplierMessage: isOnline()
            ? isAlsoCustomer
              ? "Party deleted from suppliers and customers."
              : "Supplier deleted."
            : isAlsoCustomer
              ? "Party delete queued offline and will remove it from suppliers and customers after sync."
              : "Supplier delete queued offline and will sync automatically.",
        },
      });
    } catch (nextError) {
      console.error(nextError);
      setSaveError(toUserSupplierErrorMessage(nextError));
      setLoading(false);
    }
  };

  if (!supplier && hasLoaded && !loading) {
    return (
      <Card className="lg:h-full lg:min-h-0">
        <CardHeader>
          <CardTitle>Supplier Details</CardTitle>
          <CardDescription>
            This supplier is no longer available. Return to the supplier table and
            select another record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/app/suppliers")}
          >
            Back to Suppliers
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>{supplier?.name || "Supplier Details"}</CardTitle>
        <CardDescription>
          Review and update the selected supplier record in its own detail page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 lg:max-w-3xl">
        {saveError ? <p className="text-xs text-red-700">{saveError}</p> : null}
        {supplier ? (
          <>
            {hasAccountsModule ? (
              <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Financial Summary</p>
                    <p className="text-[11px] text-muted-foreground">
                      Supplier payables, unapplied advances, and recent payment activity.
                    </p>
                  </div>
                </div>
                {financialError ? (
                  <p className="text-xs text-destructive">{financialError}</p>
                ) : financialSummary ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-4">
                      <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Total Payable</div>
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
                        <div className="text-[11px] text-muted-foreground">Unapplied Advance</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatCurrency(financialSummary.unappliedAmount)}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Supplier Credit</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatCurrency(financialSummary.documentCreditAmount)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Recent Finance Activity
                      </p>
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
              fieldIdPrefix="supplier-details"
              secondaryRoleLabel={canAlsoBeCustomer ? "Customer" : undefined}
              secondaryRoleChecked={alsoManageAsCustomer}
              onSecondaryRoleChange={setAlsoManageAsCustomer}
              secondaryRoleHint={
                canAlsoBeCustomer
                  ? isAlsoCustomer
                    ? "Clear this to keep the party only as a supplier."
                    : "Add this shared party record to the customer list too."
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
                  setAlsoManageAsCustomer(isAlsoCustomer);
                }}
                disabled={loading || !isDirty}
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app/suppliers")}
                disabled={loading}
              >
                Back to Suppliers
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
                Delete Supplier
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Loading supplier...</p>
        )}
      </CardContent>
    </Card>
  );
}
