import { useState } from "react";
import { Button } from "../atoms/Button";
import { LicenseCapabilityPicklist } from "../molecules/LicenseCapabilityPicklist";
import { BusinessDetailsFormPanes } from "./BusinessDetailsFormPanes";
import { BusinessLogoPicker } from "./BusinessLogoPicker";
import {
  BUNDLE_CAPABILITY_MAP,
  BUNDLE_KEYS,
  CAPABILITY_KEYS,
  type BundleKey,
  type CapabilityKey,
} from "../../features/admin/businesses";

type BusinessManagementCreateViewProps = {
  loading: boolean;
  error: string | null;
  newBusinessName: string;
  newOwnerPhone: string;
  newPhoneNumber: string;
  newGstin: string;
  newEmail: string;
  newBusinessType: string;
  newBusinessCategory: string;
  newState: string;
  newPincode: string;
  newAddress: string;
  newLicenseBeginsOn: string;
  newLicenseEndsOn: string;
  newLicenseBundleKey: BundleKey;
  newLicenseAddOnCapabilities: CapabilityKey[];
  newLicenseRemovedCapabilities: CapabilityKey[];
  newLicenseUserLimitType: "UNLIMITED" | "MAX_USERS" | "MAX_CONCURRENT_USERS";
  newLicenseUserLimitValue: string;
  logoPreviewUrl: string | null;
  uploadingLogo: boolean;
  onNewBusinessNameChange: (value: string) => void;
  onNewOwnerPhoneChange: (value: string) => void;
  onNewPhoneNumberChange: (value: string) => void;
  onNewGstinChange: (value: string) => void;
  onNewEmailChange: (value: string) => void;
  onNewBusinessTypeChange: (value: string) => void;
  onNewBusinessCategoryChange: (value: string) => void;
  onNewStateChange: (value: string) => void;
  onNewPincodeChange: (value: string) => void;
  onNewAddressChange: (value: string) => void;
  onNewLicenseBeginsOnChange: (value: string) => void;
  onNewLicenseEndsOnChange: (value: string) => void;
  onNewLicenseBundleKeyChange: (value: BundleKey) => void;
  onNewLicenseAddOnCapabilitiesChange: (value: CapabilityKey[]) => void;
  onNewLicenseRemovedCapabilitiesChange: (value: CapabilityKey[]) => void;
  onNewLicenseUserLimitTypeChange: (
    value: "UNLIMITED" | "MAX_USERS" | "MAX_CONCURRENT_USERS",
  ) => void;
  onNewLicenseUserLimitValueChange: (value: string) => void;
  onLogoFileChange: (file: File | null) => void;
  onCreate: () => void;
  onBackToList: () => void;
};

export function BusinessManagementCreateView({
  loading,
  error,
  newBusinessName,
  newOwnerPhone,
  newPhoneNumber,
  newGstin,
  newEmail,
  newBusinessType,
  newBusinessCategory,
  newState,
  newPincode,
  newAddress,
  newLicenseBeginsOn,
  newLicenseEndsOn,
  newLicenseBundleKey,
  newLicenseAddOnCapabilities,
  newLicenseRemovedCapabilities,
  newLicenseUserLimitType,
  newLicenseUserLimitValue,
  logoPreviewUrl,
  uploadingLogo,
  onNewBusinessNameChange,
  onNewOwnerPhoneChange,
  onNewPhoneNumberChange,
  onNewGstinChange,
  onNewEmailChange,
  onNewBusinessTypeChange,
  onNewBusinessCategoryChange,
  onNewStateChange,
  onNewPincodeChange,
  onNewAddressChange,
  onNewLicenseBeginsOnChange,
  onNewLicenseEndsOnChange,
  onNewLicenseBundleKeyChange,
  onNewLicenseAddOnCapabilitiesChange,
  onNewLicenseRemovedCapabilitiesChange,
  onNewLicenseUserLimitTypeChange,
  onNewLicenseUserLimitValueChange,
  onLogoFileChange,
  onCreate,
  onBackToList,
}: BusinessManagementCreateViewProps) {
  const [removingPreviewLogo, setRemovingPreviewLogo] = useState(false);

  return (
    <div className="space-y-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/70 bg-white/65 p-2 lg:shrink-0">
        <BusinessLogoPicker
          logoUrl={logoPreviewUrl}
          disabled={uploadingLogo || removingPreviewLogo}
          onApplyLogoFile={async (file) => {
            onLogoFileChange(file);
          }}
          onRemoveLogo={async () => {
            setRemovingPreviewLogo(true);
            try {
              onLogoFileChange(null);
            } finally {
              setRemovingPreviewLogo(false);
            }
          }}
        />
        <div className="space-y-0.5">
          <p className="text-[11px] leading-tight text-muted-foreground">Use the avatar icons to upload or remove logo.</p>
          <p className="text-[11px] leading-tight text-muted-foreground">PNG, JPG or WEBP up to 2MB.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            onClick={onCreate}
            disabled={loading || !newBusinessName.trim() || !newOwnerPhone.trim()}
            className="h-7 px-2 text-[11px]"
          >
            Create Business
          </Button>
          <Button
            variant="outline"
            onClick={onBackToList}
            disabled={loading}
            className="h-7 px-2 text-[11px]"
          >
            Cancel
          </Button>
        </div>
      </div>

      <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
        <div className="lg:min-h-0 lg:flex-1">
          <BusinessDetailsFormPanes
          values={{
            name: newBusinessName,
            ownerPhone: newOwnerPhone,
            gstin: newGstin,
            phoneNumber: newPhoneNumber,
            email: newEmail,
            state: newState,
            pincode: newPincode,
            address: newAddress,
            businessType: newBusinessType,
            businessCategory: newBusinessCategory,
          }}
          editable
          disabled={loading}
          idPrefix="new"
          showOwnerPhoneInput
          nameRequired
          ownerPhoneRequired
          namePlaceholder="Sunrise Traders"
          ownerPhonePlaceholder="10 digit phone"
          rightColumnExtra={
            <fieldset className="space-y-2 rounded-lg border border-[#d7e2ef] bg-white p-2">
              <legend className="m-0 rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
                License
              </legend>
              <div className="grid gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="grid content-start gap-2">
                  <div className="grid gap-2 lg:grid-cols-2">
                    <label className="grid gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                      Begin date
                      <input
                        type="date"
                        value={newLicenseBeginsOn}
                        onChange={(event) => onNewLicenseBeginsOnChange(event.target.value)}
                        disabled={loading}
                        className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                      />
                    </label>
                    <label className="grid gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                      End date
                      <input
                        type="date"
                        value={newLicenseEndsOn}
                        onChange={(event) => onNewLicenseEndsOnChange(event.target.value)}
                        disabled={loading}
                        className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_4.75rem] lg:gap-4">
                    <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                      User limit mode
                      <select
                        value={newLicenseUserLimitType}
                        onChange={(event) =>
                          onNewLicenseUserLimitTypeChange(
                            event.target.value as "UNLIMITED" | "MAX_USERS" | "MAX_CONCURRENT_USERS",
                          )
                        }
                        disabled={loading}
                        className="h-8 w-full min-w-0 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                      >
                        <option value="UNLIMITED">Unlimited users</option>
                        <option value="MAX_USERS">Max users per business</option>
                        <option value="MAX_CONCURRENT_USERS">Max concurrent users</option>
                      </select>
                    </label>
                    {newLicenseUserLimitType !== "UNLIMITED" ? (
                      <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                        User limit
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={3}
                          value={newLicenseUserLimitValue}
                          onChange={(event) =>
                            onNewLicenseUserLimitValueChange(
                              event.target.value.replace(/\D/g, "").slice(0, 3),
                            )
                          }
                          disabled={loading}
                          className="h-8 w-full min-w-0 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                        />
                      </label>
                    ) : (
                      <div />
                    )}
                  </div>
                  <label className="hidden gap-1 text-[11px] text-muted-foreground lg:grid lg:text-[10px]">
                    Bundle
                    <select
                      value={newLicenseBundleKey}
                      onChange={(event) =>
                        onNewLicenseBundleKeyChange(event.target.value as BundleKey)
                      }
                      disabled={loading}
                      className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                    >
                      {BUNDLE_KEYS.map((bundleKey) => (
                        <option key={bundleKey} value={bundleKey}>
                          {bundleKey}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid content-start gap-2">
                  <label className="grid gap-1 text-[11px] text-muted-foreground lg:hidden">
                    Bundle
                    <select
                      value={newLicenseBundleKey}
                      onChange={(event) =>
                        onNewLicenseBundleKeyChange(event.target.value as BundleKey)
                      }
                      disabled={loading}
                      className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                    >
                      {BUNDLE_KEYS.map((bundleKey) => (
                        <option key={bundleKey} value={bundleKey}>
                          {bundleKey}
                        </option>
                      ))}
                    </select>
                  </label>

                  <LicenseCapabilityPicklist
                    capabilities={CAPABILITY_KEYS}
                    bundleCapabilities={BUNDLE_CAPABILITY_MAP[newLicenseBundleKey] ?? []}
                    addOnCapabilities={newLicenseAddOnCapabilities}
                    removedCapabilities={newLicenseRemovedCapabilities}
                    disabled={loading}
                    onAddOnCapabilitiesChange={(next) =>
                      onNewLicenseAddOnCapabilitiesChange(next as CapabilityKey[])
                    }
                    onRemovedCapabilitiesChange={(next) =>
                      onNewLicenseRemovedCapabilitiesChange(next as CapabilityKey[])
                    }
                  />
                </div>
              </div>
            </fieldset>
          }
            onFieldChange={(field, value) => {
              if (field === "name") onNewBusinessNameChange(value);
              if (field === "ownerPhone") onNewOwnerPhoneChange(value);
              if (field === "gstin") onNewGstinChange(value);
              if (field === "phoneNumber") onNewPhoneNumberChange(value);
              if (field === "email") onNewEmailChange(value);
              if (field === "state") onNewStateChange(value);
              if (field === "pincode") onNewPincodeChange(value);
              if (field === "address") onNewAddressChange(value);
              if (field === "businessType") onNewBusinessTypeChange(value);
              if (field === "businessCategory") onNewBusinessCategoryChange(value);
            }}
          />
        </div>
        {error ? <p className="text-xs text-red-600 lg:pt-1">{error}</p> : null}
      </div>
    </div>
  );
}
