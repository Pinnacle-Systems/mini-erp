import { LoadingOverlay } from "../atoms/LoadingOverlay";
import {
  Card,
  CardContent,
} from "../molecules/Card";
import type {
  AdminStore,
  AdminBusinessesPagination,
  AdminOwnerLookupResult,
  BundleKey,
  CapabilityKey,
} from "../../features/admin/businesses";
import { BusinessManagementCreateView } from "./BusinessManagementCreateView";
import { BusinessManagementListView } from "./BusinessManagementListView";

type BusinessManagementPanelProps = {
  mode: "list" | "new";
  businesses: AdminStore[];
  page: number;
  pagination: AdminBusinessesPagination;
  filterBusinessName: string;
  filterOwnerPhone: string;
  filterIncludeDeleted: boolean;
  loading: boolean;
  error: string | null;
  newBusinessName: string;
  newOwnerId?: string | null;
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
  onFilterBusinessNameChange: (value: string) => void;
  onFilterOwnerPhoneChange: (value: string) => void;
  onFilterIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
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
  onOpenStore: (business: AdminStore) => void;
  onReload: () => void;
  onBackToList: () => void;
};

export function BusinessManagementPanel({
  mode,
  businesses,
  page,
  pagination,
  filterBusinessName,
  filterOwnerPhone,
  filterIncludeDeleted,
  loading,
  error,
  newBusinessName,
  newOwnerId: _newOwnerId,
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
  onFilterBusinessNameChange,
  onFilterOwnerPhoneChange,
  onFilterIncludeDeletedChange,
  onClearFilters,
  onPrevPage,
  onNextPage,
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
  onOpenStore,
  onReload,
  onBackToList,
}: BusinessManagementPanelProps) {
  const isListView = mode === "list";

  return (
    <Card className="h-auto lg:h-full lg:min-h-0">
      <CardContent
        className={`relative ${isListView ? "space-y-2 lg:overflow-y-auto" : "space-y-2 lg:overflow-hidden"} lg:h-full lg:min-h-0`}
      >
        {isListView ? (
          <BusinessManagementListView
            businesses={businesses}
            page={page}
            pagination={pagination}
            filterBusinessName={filterBusinessName}
            filterOwnerPhone={filterOwnerPhone}
            filterIncludeDeleted={filterIncludeDeleted}
            loading={loading}
            error={error}
            onFilterBusinessNameChange={onFilterBusinessNameChange}
            onFilterOwnerPhoneChange={onFilterOwnerPhoneChange}
            onFilterIncludeDeletedChange={onFilterIncludeDeletedChange}
            onClearFilters={onClearFilters}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
            onOpenStore={onOpenStore}
            onReload={onReload}
          />
        ) : (
          <BusinessManagementCreateView
            loading={loading}
            error={error}
            newBusinessName={newBusinessName}
            newOwnerPhone={newOwnerPhone}
            ownerLookupResults={ownerLookupResults}
            ownerLookupLoading={ownerLookupLoading}
            newPhoneNumber={newPhoneNumber}
            newGstin={newGstin}
            newEmail={newEmail}
            newBusinessType={newBusinessType}
            newBusinessCategory={newBusinessCategory}
            newState={newState}
            newPincode={newPincode}
            newAddress={newAddress}
            newLicenseBeginsOn={newLicenseBeginsOn}
            newLicenseEndsOn={newLicenseEndsOn}
            newLicenseBundleKey={newLicenseBundleKey}
            newLicenseAddOnCapabilities={newLicenseAddOnCapabilities}
            newLicenseRemovedCapabilities={newLicenseRemovedCapabilities}
            newLicenseUserLimitType={newLicenseUserLimitType}
            newLicenseUserLimitValue={newLicenseUserLimitValue}
            logoPreviewUrl={logoPreviewUrl}
            uploadingLogo={uploadingLogo}
            canCreate={canCreate}
            onNewBusinessNameChange={onNewBusinessNameChange}
            onOwnerLookupQueryChange={onOwnerLookupQueryChange}
            onOwnerSelect={onOwnerSelect}
            onNewOwnerPhoneChange={onNewOwnerPhoneChange}
            onNewPhoneNumberChange={onNewPhoneNumberChange}
            onNewGstinChange={onNewGstinChange}
            onNewEmailChange={onNewEmailChange}
            onNewBusinessTypeChange={onNewBusinessTypeChange}
            onNewBusinessCategoryChange={onNewBusinessCategoryChange}
            onNewStateChange={onNewStateChange}
            onNewPincodeChange={onNewPincodeChange}
            onNewAddressChange={onNewAddressChange}
            onNewLicenseBeginsOnChange={onNewLicenseBeginsOnChange}
            onNewLicenseEndsOnChange={onNewLicenseEndsOnChange}
            onNewLicenseBundleKeyChange={onNewLicenseBundleKeyChange}
            onNewLicenseAddOnCapabilitiesChange={onNewLicenseAddOnCapabilitiesChange}
            onNewLicenseRemovedCapabilitiesChange={onNewLicenseRemovedCapabilitiesChange}
            onNewLicenseUserLimitTypeChange={onNewLicenseUserLimitTypeChange}
            onNewLicenseUserLimitValueChange={onNewLicenseUserLimitValueChange}
            onLogoFileChange={onLogoFileChange}
            onCreate={onCreate}
            onBackToList={onBackToList}
          />
        )}
        <LoadingOverlay visible={loading} label="Updating businesses" />
      </CardContent>
    </Card>
  );
}
