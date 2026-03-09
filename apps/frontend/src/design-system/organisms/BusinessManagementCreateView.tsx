import { useState } from "react";
import { LookupDropdownInput } from "../molecules/LookupDropdownInput";
import { PageActionBar } from "../molecules/PageActionBar";
import { BusinessDetailsFormPanes } from "./BusinessDetailsFormPanes";
import { BusinessLicensePane } from "./BusinessLicensePane";
import { BusinessLogoPicker } from "./BusinessLogoPicker";
import {
  type AdminOwnerLookupResult,
  type BundleKey,
  type CapabilityKey,
} from "../../features/admin/businesses";

type BusinessManagementCreateViewProps = {
  loading: boolean;
  error: string | null;
  newBusinessName: string;
  newOwnerPhone: string;
  ownerLookupResults: AdminOwnerLookupResult[];
  ownerLookupLoading: boolean;
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
  canCreate: boolean;
  onNewBusinessNameChange: (value: string) => void;
  onOwnerLookupQueryChange: (value: string) => void;
  onOwnerSelect: (owner: AdminOwnerLookupResult) => void;
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
  ownerLookupResults,
  ownerLookupLoading,
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
  canCreate,
  onNewBusinessNameChange,
  onOwnerLookupQueryChange,
  onOwnerSelect,
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
    <div className="space-y-2 pb-20 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:pb-0">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-white p-2 lg:shrink-0">
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
        <PageActionBar
          className="ml-auto"
          primaryLabel="Create Business"
          onPrimaryClick={onCreate}
          primaryDisabled={loading || !canCreate}
          primaryLoading={loading}
          primaryLoadingLabel="Saving..."
          secondaryLabel="Cancel"
          onSecondaryClick={onBackToList}
          secondaryDisabled={loading}
        />
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
          ownerPhoneLabel="Owner"
          namePlaceholder="Sunrise Traders"
          ownerPhonePlaceholder="Search owner by name, phone or email"
          ownerInput={
            <LookupDropdownInput
              id="new-owner-phone"
              value={newOwnerPhone}
              onValueChange={onOwnerLookupQueryChange}
              placeholder="Search owner by name, phone or email"
              disabled={loading}
              loading={ownerLookupLoading}
              loadingLabel="Searching owners..."
              options={ownerLookupResults}
              getOptionKey={(owner) => owner.id}
              getOptionSearchText={(owner) =>
                `${owner.name ?? ""} ${owner.phone ?? ""} ${owner.email ?? ""}`
              }
              onOptionSelect={onOwnerSelect}
              renderOption={(owner) => (
                <>
                  <div className="truncate font-medium">
                    {(owner.name?.trim() || "Unnamed owner") +
                      (owner.phone ? ` | ${owner.phone}` : " | No phone")}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {owner.email || "No email"}
                  </div>
                </>
              )}
              inputClassName="h-8 w-full rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
            />
          }
          rightColumnExtra={
            <BusinessLicensePane
              beginsOn={newLicenseBeginsOn}
              endsOn={newLicenseEndsOn}
              bundleKey={newLicenseBundleKey}
              addOnCapabilities={newLicenseAddOnCapabilities}
              removedCapabilities={newLicenseRemovedCapabilities}
              userLimitType={newLicenseUserLimitType}
              userLimitValue={newLicenseUserLimitValue}
              disabled={loading}
              onBeginsOnChange={onNewLicenseBeginsOnChange}
              onEndsOnChange={onNewLicenseEndsOnChange}
              onBundleKeyChange={onNewLicenseBundleKeyChange}
              onAddOnCapabilitiesChange={onNewLicenseAddOnCapabilitiesChange}
              onRemovedCapabilitiesChange={onNewLicenseRemovedCapabilitiesChange}
              onUserLimitTypeChange={onNewLicenseUserLimitTypeChange}
              onUserLimitValueChange={onNewLicenseUserLimitValueChange}
            />
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
