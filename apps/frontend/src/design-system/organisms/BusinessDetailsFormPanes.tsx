import type { ReactNode } from "react";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { Select } from "../atoms/Select";
import { Textarea } from "../atoms/Textarea";
import { INDIA_STATES } from "../../lib/india-states";
import { BUSINESS_TYPES } from "../../lib/business-types";
import { BUSINESS_CATEGORIES } from "../../lib/business-categories";

export type BusinessDetailsFormValues = {
  name: string;
  ownerPhone: string;
  gstin: string;
  phoneNumber: string;
  email: string;
  state: string;
  pincode: string;
  address: string;
  businessType: string;
  businessCategory: string;
};

type BusinessDetailsFormPanesProps = {
  values: BusinessDetailsFormValues;
  editable: boolean;
  disabled: boolean;
  idPrefix: string;
  onFieldChange: (field: keyof BusinessDetailsFormValues, value: string) => void;
  showOwnerPhoneInput: boolean;
  ownerDisplay?: ReactNode;
  nameRequired?: boolean;
  ownerPhoneRequired?: boolean;
  nameLabel?: string;
  ownerPhoneLabel?: string;
  namePlaceholder?: string;
  ownerPhonePlaceholder?: string;
};

export function BusinessDetailsFormPanes({
  values,
  editable,
  disabled,
  idPrefix,
  onFieldChange,
  showOwnerPhoneInput,
  ownerDisplay,
  nameRequired = false,
  ownerPhoneRequired = false,
  nameLabel = "Business name",
  ownerPhoneLabel = "Owner phone",
  namePlaceholder,
  ownerPhonePlaceholder,
}: BusinessDetailsFormPanesProps) {
  return (
    <div className="space-y-2 overflow-visible pr-1 lg:min-h-0 lg:overflow-y-auto">
      <fieldset className="space-y-2 rounded-lg border border-[#d7e2ef] bg-white p-2">
        <legend className="rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
          Basic Information
        </legend>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-business-name`}>
              {nameLabel}
              {nameRequired ? " *" : ""}
            </Label>
            <Input
              id={`${idPrefix}-business-name`}
              value={values.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              placeholder={namePlaceholder}
              readOnly={!editable}
              disabled={disabled}
              required={nameRequired}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-owner-phone`}>
              {ownerPhoneLabel}
              {ownerPhoneRequired ? " *" : ""}
            </Label>
            {showOwnerPhoneInput ? (
              <Input
                id={`${idPrefix}-owner-phone`}
                value={values.ownerPhone}
                onChange={(event) => onFieldChange("ownerPhone", event.target.value)}
                placeholder={ownerPhonePlaceholder}
                readOnly={!editable}
                disabled={disabled}
                required={ownerPhoneRequired}
              />
            ) : (
              ownerDisplay
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-gstin`}>GSTIN</Label>
            <Input
              id={`${idPrefix}-gstin`}
              value={values.gstin}
              onChange={(event) => onFieldChange("gstin", event.target.value)}
              readOnly={!editable}
              disabled={disabled}
            />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-2 md:grid-cols-2">
        <fieldset className="space-y-2 rounded-lg border border-[#d7e2ef] bg-white p-2">
          <legend className="rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
            Contact
          </legend>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-phone-number`}>Business phone</Label>
              <Input
                id={`${idPrefix}-phone-number`}
                value={values.phoneNumber}
                onChange={(event) => onFieldChange("phoneNumber", event.target.value)}
                readOnly={!editable}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-email`}>Business email</Label>
              <Input
                id={`${idPrefix}-email`}
                value={values.email}
                onChange={(event) => onFieldChange("email", event.target.value)}
                readOnly={!editable}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`${idPrefix}-address`}>Address</Label>
              <Textarea
                id={`${idPrefix}-address`}
                value={values.address}
                onChange={(event) => onFieldChange("address", event.target.value)}
                readOnly={!editable}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-state`}>State</Label>
              {editable ? (
                <Select
                  id={`${idPrefix}-state`}
                  value={values.state}
                  onChange={(event) => onFieldChange("state", event.target.value)}
                  disabled={disabled}
                >
                  <option value="">Select state</option>
                  {INDIA_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={`${idPrefix}-state`}
                  value={values.state}
                  readOnly
                  disabled={disabled}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-pincode`}>Pincode</Label>
              <Input
                id={`${idPrefix}-pincode`}
                className="max-w-[8rem]"
                value={values.pincode}
                onChange={(event) =>
                  onFieldChange(
                    "pincode",
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                inputMode="numeric"
                maxLength={6}
                readOnly={!editable}
                disabled={disabled}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-2 rounded-lg border border-[#d7e2ef] bg-white p-2">
          <legend className="rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
            Business Profile
          </legend>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-business-type`}>Business type</Label>
              {editable ? (
                <Select
                  id={`${idPrefix}-business-type`}
                  value={values.businessType}
                  onChange={(event) => onFieldChange("businessType", event.target.value)}
                  disabled={disabled}
                >
                  <option value="">Select business type</option>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={`${idPrefix}-business-type`}
                  value={values.businessType}
                  readOnly
                  disabled={disabled}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-business-category`}>
                Business category
              </Label>
              {editable ? (
                <Select
                  id={`${idPrefix}-business-category`}
                  value={values.businessCategory}
                  onChange={(event) =>
                    onFieldChange("businessCategory", event.target.value)
                  }
                  disabled={disabled}
                >
                  <option value="">Select business category</option>
                  {BUSINESS_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={`${idPrefix}-business-category`}
                  value={values.businessCategory}
                  readOnly
                  disabled={disabled}
                />
              )}
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
