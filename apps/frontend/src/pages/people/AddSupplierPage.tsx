import { useState } from "react";
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
  toUserSupplierErrorMessage,
} from "./customer-utils";

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export function AddSupplierPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [draft, setDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [alsoCreateCustomer, setAlsoCreateCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;
  const canAlsoBeCustomer = hasAssignedStoreCapability(activeBusiness, "PARTIES_CUSTOMERS");

  const onSave = async () => {
    if (!activeStore || !identityId || !isBusinessSelected || loading) {
      return;
    }

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setError("Supplier name is required.");
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
      await queueSupplierCreate(activeStore, identityId, payload, sharedEntityId);
      if (alsoCreateCustomer && canAlsoBeCustomer) {
        await queueCustomerCreate(activeStore, identityId, payload, sharedEntityId);
      }
      await syncOnce(activeStore);
      navigate("/app/suppliers", {
        replace: true,
        state: {
          supplierMessage: isOnline()
            ? alsoCreateCustomer && canAlsoBeCustomer
              ? "Supplier saved and added to customers."
              : "Supplier saved."
            : alsoCreateCustomer && canAlsoBeCustomer
              ? "Supplier and customer records queued offline and will sync automatically."
              : "Supplier queued offline and will sync automatically.",
        },
      });
    } catch (nextError) {
      console.error(nextError);
      setError(toUserSupplierErrorMessage(nextError));
      setLoading(false);
    }
  };

  return (
    <Card className="lg:h-full lg:min-h-0">
      <CardHeader>
        <CardTitle>Add Supplier</CardTitle>
        <CardDescription>
          Create a supplier record in its own form, then return to the supplier
          table for review and edits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 lg:max-w-3xl">
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <CustomerFormFields
          draft={draft}
          setDraft={setDraft}
          disabled={loading}
          fieldIdPrefix="new-supplier"
          secondaryRoleLabel={canAlsoBeCustomer ? "Customer" : undefined}
          secondaryRoleChecked={alsoCreateCustomer}
          onSecondaryRoleChange={setAlsoCreateCustomer}
          secondaryRoleHint={
            canAlsoBeCustomer
              ? "Use one shared party record in both supplier and customer lists."
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
            {loading ? "Saving..." : "Add Supplier"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/app/suppliers")}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
