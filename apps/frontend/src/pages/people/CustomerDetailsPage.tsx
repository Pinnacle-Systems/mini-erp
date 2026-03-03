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
import { useSessionStore } from "../../features/auth/session-business";
import {
  getLocalCustomers,
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

export function CustomerDetailsPage() {
  const navigate = useNavigate();
  const { customerId = "" } = useParams();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [draft, setDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [initialDraft, setInitialDraft] = useState(EMPTY_CUSTOMER_DRAFT);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected || !customerId) {
      setCustomer(null);
      setDraft(EMPTY_CUSTOMER_DRAFT);
      setInitialDraft(EMPTY_CUSTOMER_DRAFT);
      setHasLoaded(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const localRows = await getLocalCustomers(activeStore);
        const localCustomer =
          localRows.find((row) => row.entityId === customerId) ?? null;
        if (!cancelled) {
          setCustomer(localCustomer);
          const nextDraft = localCustomer
            ? toCustomerDraft(localCustomer)
            : EMPTY_CUSTOMER_DRAFT;
          setDraft(nextDraft);
          setInitialDraft(nextDraft);
          setSaveError(null);
        }

        await syncOnce(activeStore);
        const syncedRows = await getLocalCustomers(activeStore);
        const syncedCustomer =
          syncedRows.find((row) => row.entityId === customerId) ?? null;
        if (!cancelled) {
          setCustomer(syncedCustomer);
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

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialDraft),
    [draft, initialDraft],
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
      await syncOnce(activeStore);
      navigate("/app/customers", {
        replace: true,
        state: {
          customerMessage: isOnline()
            ? "Customer updated."
            : "Customer update queued offline and will sync automatically.",
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
            <CustomerFormFields
              draft={draft}
              setDraft={setDraft}
              disabled={loading}
              fieldIdPrefix="details"
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
                onClick={() => setDraft(initialDraft)}
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
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Loading customer...</p>
        )}
      </CardContent>
    </Card>
  );
}
