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
import { useSessionStore } from "../../features/auth/session-business";
import { queueCustomerCreate, syncOnce } from "../../features/sync/engine";
import { CustomerFormFields } from "./customer-form";
import {
  EMPTY_CUSTOMER_DRAFT,
  toUserCustomerErrorMessage,
} from "./customer-utils";

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export function AddCustomerPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [draft, setDraft] = useState(EMPTY_CUSTOMER_DRAFT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await queueCustomerCreate(activeStore, identityId, {
        ...draft,
        name: trimmedName,
      });
      await syncOnce(activeStore);
      navigate("/app/customers", {
        replace: true,
        state: {
          customerMessage: isOnline()
            ? "Customer saved."
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
        <CardTitle>Add Customer</CardTitle>
        <CardDescription>
          Create a customer record in its own form, then return to the customer
          table for review and edits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 lg:max-w-3xl">
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <CustomerFormFields
          draft={draft}
          setDraft={setDraft}
          disabled={loading}
          fieldIdPrefix="new"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              void onSave();
            }}
            disabled={!activeStore || !isBusinessSelected || !identityId || loading}
          >
            {loading ? "Saving..." : "Add Customer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/app/customers")}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
