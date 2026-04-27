import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../design-system/atoms/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import {
  hasAssignedStoreCapability,
  useSessionStore,
} from "../../features/auth/session-business";
import {
  queueCustomerCreate,
  queueSupplierCreate,
  syncOnce,
} from "../../features/sync/engine";
import { CustomerFormFields } from "./customer-form";
import {
  EMPTY_CUSTOMER_DRAFT,
  toUserCustomerErrorMessage,
} from "./customer-utils";

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export function AddCustomerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const locationState =
    location.state && typeof location.state === "object"
      ? (location.state as {
          returnTo?: string;
          invoiceDraft?: unknown;
          customerPrefill?: {
            name?: string;
            phone?: string;
          };
        })
      : null;
  const [draft, setDraft] = useState(() => ({
    ...EMPTY_CUSTOMER_DRAFT,
    name: locationState?.customerPrefill?.name ?? EMPTY_CUSTOMER_DRAFT.name,
    phone: locationState?.customerPrefill?.phone ?? EMPTY_CUSTOMER_DRAFT.phone,
  }));
  const [alsoCreateSupplier, setAlsoCreateSupplier] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;
  const canAlsoBeSupplier = hasAssignedStoreCapability(activeBusiness, "PARTIES_SUPPLIERS");
  const isBillingReturnFlow = locationState?.returnTo === "/app/sales-bills";

  const onSave = async () => {
    if (!activeStore || !identityId || !isBusinessSelected || loading) {
      return;
    }

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setError("Customer name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sharedEntityId = crypto.randomUUID();
      const payload = {
        ...draft,
        name: trimmedName,
      };
      await queueCustomerCreate(activeStore, identityId, payload, sharedEntityId);
      if (alsoCreateSupplier && canAlsoBeSupplier) {
        await queueSupplierCreate(activeStore, identityId, payload, sharedEntityId);
      }
      await syncOnce(activeStore);

      if (locationState?.returnTo) {
        navigate(locationState.returnTo, {
          replace: true,
          state: {
            invoiceDraft: locationState.invoiceDraft,
            createdCustomer: {
              entityId: sharedEntityId,
              name: payload.name,
              phone: payload.phone,
              email: payload.email,
              address: payload.address,
              gstNo: payload.gstNo,
              pending: !isOnline(),
            },
            customerMessage: isOnline()
              ? "Customer saved and returned to billing."
              : "Customer queued offline and returned to billing.",
          },
        });
        return;
      }

      navigate("/app/customers", {
        replace: true,
        state: {
          customerMessage: isOnline()
            ? alsoCreateSupplier && canAlsoBeSupplier
              ? "Customer saved and added to suppliers."
              : "Customer saved."
            : alsoCreateSupplier && canAlsoBeSupplier
              ? "Customer and supplier records queued offline and will sync automatically."
              : "Customer queued offline and will sync automatically.",
        },
      });
    } catch (nextError) {
      console.error(nextError);
      setError(toUserCustomerErrorMessage(nextError));
      setLoading(false);
    }
  };

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>{isBillingReturnFlow ? "Add Customer For Billing" : "Add Customer"}</CardTitle>
        <CardDescription>
          {isBillingReturnFlow
            ? "Create the customer, then return directly to the in-progress invoice with the draft restored."
            : "Create a customer record in its own form, then return to the customer table for review and edits."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 lg:max-w-3xl">
        {isBillingReturnFlow ? (
          <div className="rounded-lg border border-[#c5d8ee] bg-[#edf5ff] px-3 py-2 text-[11px] text-[#1f4167]">
            <div className="font-semibold">Billing handoff in progress</div>
            <div className="mt-0.5">
              Save this customer to return to the invoice. Cancel will also take you back without losing the current draft.
            </div>
          </div>
        ) : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <CustomerFormFields
          draft={draft}
          setDraft={setDraft}
          disabled={loading}
          fieldIdPrefix="new"
          secondaryRoleLabel={canAlsoBeSupplier ? "Supplier" : undefined}
          secondaryRoleChecked={alsoCreateSupplier}
          onSecondaryRoleChange={setAlsoCreateSupplier}
          secondaryRoleHint={
            canAlsoBeSupplier
              ? "Use one shared party record in both customer and supplier lists."
              : undefined
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              void onSave();
            }}
            disabled={!activeStore || !isBusinessSelected || !identityId || loading}
          >
            {loading
              ? "Saving..."
              : isBillingReturnFlow
                ? "Save Customer And Return"
                : "Add Customer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate(locationState?.returnTo ?? "/app/customers", {
                state: locationState?.returnTo
                  ? {
                      invoiceDraft: locationState.invoiceDraft,
                    }
                  : undefined,
              })
            }
            disabled={loading}
          >
            {isBillingReturnFlow ? "Back To Invoice" : "Cancel"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
