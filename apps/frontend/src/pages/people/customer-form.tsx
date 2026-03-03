import type { Dispatch, SetStateAction } from "react";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import type { CustomerDraft } from "./customer-utils";

type CustomerFormFieldsProps = {
  draft: CustomerDraft;
  setDraft: Dispatch<SetStateAction<CustomerDraft>>;
  disabled: boolean;
  fieldIdPrefix: string;
};

export function CustomerFormFields({
  draft,
  setDraft,
  disabled,
  fieldIdPrefix,
}: CustomerFormFieldsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldIdPrefix}-customer-name`}>Customer Name</Label>
        <Input
          id={`${fieldIdPrefix}-customer-name`}
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldIdPrefix}-customer-phone`}>Phone</Label>
        <Input
          id={`${fieldIdPrefix}-customer-phone`}
          value={draft.phone ?? ""}
          onChange={(event) =>
            setDraft((current) => ({ ...current, phone: event.target.value }))
          }
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldIdPrefix}-customer-email`}>Email</Label>
        <Input
          id={`${fieldIdPrefix}-customer-email`}
          value={draft.email ?? ""}
          onChange={(event) =>
            setDraft((current) => ({ ...current, email: event.target.value }))
          }
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldIdPrefix}-customer-gst`}>GST No.</Label>
        <Input
          id={`${fieldIdPrefix}-customer-gst`}
          value={draft.gstNo ?? ""}
          onChange={(event) =>
            setDraft((current) => ({ ...current, gstNo: event.target.value }))
          }
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${fieldIdPrefix}-customer-address`}>Address</Label>
        <Input
          id={`${fieldIdPrefix}-customer-address`}
          value={draft.address ?? ""}
          onChange={(event) =>
            setDraft((current) => ({ ...current, address: event.target.value }))
          }
          disabled={disabled}
        />
      </div>
    </div>
  );
}
