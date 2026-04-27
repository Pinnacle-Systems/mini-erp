import type { Dispatch, SetStateAction } from "react";
import { Checkbox } from "../../design-system/atoms/Checkbox";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import type { CustomerDraft } from "./customer-utils";

type CustomerFormFieldsProps = {
  draft: CustomerDraft;
  setDraft: Dispatch<SetStateAction<CustomerDraft>>;
  disabled: boolean;
  fieldIdPrefix: string;
  secondaryRoleLabel?: string;
  secondaryRoleChecked?: boolean;
  secondaryRoleDisabled?: boolean;
  onSecondaryRoleChange?: (checked: boolean) => void;
  secondaryRoleHint?: string;
};

export function CustomerFormFields({
  draft,
  setDraft,
  disabled,
  fieldIdPrefix,
  secondaryRoleLabel,
  secondaryRoleChecked = false,
  secondaryRoleDisabled = false,
  onSecondaryRoleChange,
  secondaryRoleHint,
}: CustomerFormFieldsProps) {
  return (
    <div className="space-y-3">
      {secondaryRoleLabel ? (
        <div className="space-y-1.5 rounded-xl border border-border bg-card px-3 py-2">
          <div className="flex items-start gap-2">
            <Checkbox
              id={`${fieldIdPrefix}-secondary-role`}
              checked={secondaryRoleChecked}
              disabled={disabled || secondaryRoleDisabled}
              onChange={(event) => onSecondaryRoleChange?.(event.target.checked)}
            />
            <div className="space-y-0.5">
              <Label htmlFor={`${fieldIdPrefix}-secondary-role`}>
                Also use this party as a {secondaryRoleLabel.toLowerCase()}
              </Label>
              {secondaryRoleHint ? (
                <p className="text-[11px] text-muted-foreground">{secondaryRoleHint}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldIdPrefix}-customer-name`}>Name</Label>
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
    </div>
  );
}
