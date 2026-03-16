import type { ReactNode } from "react";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { Select } from "../atoms/Select";
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
  ownerInput?: ReactNode;
  nameRequired?: boolean;
  ownerPhoneRequired?: boolean;
  nameLabel?: string;
  ownerPhoneLabel?: string;
  namePlaceholder?: string;
  ownerPhonePlaceholder?: string;
  rightColumnExtra?: ReactNode;
};

export function BusinessDetailsFormPanes({
  values,
  editable,
  disabled,
  idPrefix,
  onFieldChange,
  showOwnerPhoneInput,
  ownerDisplay,
  ownerInput,
  nameRequired = false,
  ownerPhoneRequired = false,
  nameLabel = "Business name",
  ownerPhoneLabel = "Owner phone",
  namePlaceholder,
  ownerPhonePlaceholder,
  rightColumnExtra,
}: BusinessDetailsFormPanesProps) {
  const fieldStackClass = "space-y-1";
  const inlineFieldClass =
    "grid gap-1 lg:grid-cols-[7.5rem_minmax(0,1fr)] lg:items-center lg:gap-2";
  const inlineLabelClass = "lg:text-right lg:text-[10px] lg:text-muted-foreground";
  const controlClassName =
    "h-8 w-full rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground";

  return (
    <div className="space-y-2 overflow-visible pr-1 lg:h-full lg:min-h-0 lg:overflow-y-auto">
      <div className="grid gap-2 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(24rem,1.35fr)]">
        <div className="space-y-2">
          <fieldset className="space-y-1.5 rounded-lg border border-[#d7e2ef] bg-white p-2">
            <legend className="m-0 rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
              Core Info
            </legend>
            <div className="grid gap-2">
              <div className="grid gap-2">
                <div className={inlineFieldClass}>
                  <Label
                    htmlFor={`${idPrefix}-business-name`}
                    className={inlineLabelClass}
                  >
                    {nameLabel}
                    {nameRequired ? " *" : ""}
                  </Label>
                  <Input
                    id={`${idPrefix}-business-name`}
                    className={controlClassName}
                    value={values.name}
                    onChange={(event) => onFieldChange("name", event.target.value)}
                    placeholder={namePlaceholder}
                    readOnly={!editable}
                    disabled={disabled}
                    required={nameRequired}
                  />
                </div>

                <div className={inlineFieldClass}>
                  <Label
                    htmlFor={`${idPrefix}-owner-phone`}
                    className={inlineLabelClass}
                  >
                    {ownerPhoneLabel}
                    {ownerPhoneRequired ? " *" : ""}
                  </Label>
                  <div className="min-w-0">
                    {showOwnerPhoneInput ? (
                      ownerInput ?? (
                        <Input
                          id={`${idPrefix}-owner-phone`}
                          value={values.ownerPhone}
                          onChange={(event) => onFieldChange("ownerPhone", event.target.value)}
                          placeholder={ownerPhonePlaceholder}
                          readOnly={!editable}
                          disabled={disabled}
                          required={ownerPhoneRequired}
                        />
                      )
                    ) : (
                      ownerDisplay
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className={fieldStackClass}>
                  <Label htmlFor={`${idPrefix}-gstin`}>GSTIN</Label>
                  <Input
                    id={`${idPrefix}-gstin`}
                    className={controlClassName}
                    value={values.gstin}
                    onChange={(event) => onFieldChange("gstin", event.target.value)}
                    readOnly={!editable}
                    disabled={disabled}
                  />
                </div>

                <div className={fieldStackClass}>
                  <Label htmlFor={`${idPrefix}-business-type`}>Business type</Label>
                  {editable ? (
                    <Select
                      id={`${idPrefix}-business-type`}
                      className={controlClassName}
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
                      className={controlClassName}
                      value={values.businessType}
                      readOnly
                      disabled={disabled}
                    />
                  )}
                </div>

                <div className="md:col-span-2">
                  <div className={inlineFieldClass}>
                    <Label
                      htmlFor={`${idPrefix}-business-category`}
                      className={inlineLabelClass}
                    >
                      Business category
                    </Label>
                    {editable ? (
                      <Select
                        id={`${idPrefix}-business-category`}
                        className={controlClassName}
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
                        className={controlClassName}
                        value={values.businessCategory}
                        readOnly
                        disabled={disabled}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-1.5 rounded-lg border border-[#d7e2ef] bg-white p-2">
            <legend className="m-0 rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
              Contact
            </legend>
            <div className="grid gap-2 md:grid-cols-2">
              <div className={fieldStackClass}>
                <Label htmlFor={`${idPrefix}-phone-number`}>Business phone</Label>
                <Input
                  id={`${idPrefix}-phone-number`}
                  className={controlClassName}
                  value={values.phoneNumber}
                  onChange={(event) => onFieldChange("phoneNumber", event.target.value)}
                  readOnly={!editable}
                  disabled={disabled}
                />
              </div>

              <div className={fieldStackClass}>
                <Label htmlFor={`${idPrefix}-email`}>Business email</Label>
                <Input
                  id={`${idPrefix}-email`}
                  className={controlClassName}
                  value={values.email}
                  onChange={(event) => onFieldChange("email", event.target.value)}
                  readOnly={!editable}
                  disabled={disabled}
                />
              </div>

              <div className={`${fieldStackClass} md:col-span-2`}>
                <Label htmlFor={`${idPrefix}-address`}>Address</Label>
                <Input
                  id={`${idPrefix}-address`}
                  className={controlClassName}
                  value={values.address}
                  onChange={(event) => onFieldChange("address", event.target.value)}
                  readOnly={!editable}
                  disabled={disabled}
                />
              </div>

              <div className={fieldStackClass}>
                <Label htmlFor={`${idPrefix}-state`}>State</Label>
                {editable ? (
                  <Select
                    id={`${idPrefix}-state`}
                    className={controlClassName}
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
                    className={controlClassName}
                    value={values.state}
                    readOnly
                    disabled={disabled}
                  />
                )}
              </div>

              <div className={fieldStackClass}>
                <Label htmlFor={`${idPrefix}-pincode`}>Pincode</Label>
                <Input
                  id={`${idPrefix}-pincode`}
                  className={`${controlClassName} max-w-[8rem]`}
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
        </div>

        <div className="space-y-2">
          {rightColumnExtra}
        </div>
      </div>
    </div>
  );
}
