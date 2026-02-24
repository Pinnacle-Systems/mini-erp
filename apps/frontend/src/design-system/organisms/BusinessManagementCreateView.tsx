import { useState } from "react";
import { Button } from "../atoms/Button";
import { BusinessDetailsFormPanes } from "./BusinessDetailsFormPanes";
import { BusinessLogoPicker } from "./BusinessLogoPicker";

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
  onLogoFileChange,
  onCreate,
  onBackToList,
}: BusinessManagementCreateViewProps) {
  const [removingPreviewLogo, setRemovingPreviewLogo] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/70 bg-white/65 p-2">
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
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </>
  );
}
