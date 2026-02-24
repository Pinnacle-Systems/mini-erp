import { Button } from "../atoms/Button";
import { LoadingOverlay } from "../atoms/LoadingOverlay";
import {
  Card,
  CardContent,
} from "../molecules/Card";
import type {
  AdminStore,
  AdminBusinessesPagination,
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
  onFilterBusinessNameChange: (value: string) => void;
  onFilterOwnerPhoneChange: (value: string) => void;
  onFilterIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
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
  onFilterBusinessNameChange,
  onFilterOwnerPhoneChange,
  onFilterIncludeDeletedChange,
  onClearFilters,
  onPrevPage,
  onNextPage,
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
  onOpenStore,
  onReload,
  onBackToList,
}: BusinessManagementPanelProps) {
  const isListView = mode === "list";

  return (
    <Card className="h-auto lg:h-full lg:min-h-0">
      <CardContent
        className={`relative ${isListView ? "space-y-0" : "space-y-2"} lg:h-full lg:min-h-0 lg:overflow-y-auto`}
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
            newPhoneNumber={newPhoneNumber}
            newGstin={newGstin}
            newEmail={newEmail}
            newBusinessType={newBusinessType}
            newBusinessCategory={newBusinessCategory}
            newState={newState}
            newPincode={newPincode}
            newAddress={newAddress}
            logoPreviewUrl={logoPreviewUrl}
            uploadingLogo={uploadingLogo}
            onNewBusinessNameChange={onNewBusinessNameChange}
            onNewOwnerPhoneChange={onNewOwnerPhoneChange}
            onNewPhoneNumberChange={onNewPhoneNumberChange}
            onNewGstinChange={onNewGstinChange}
            onNewEmailChange={onNewEmailChange}
            onNewBusinessTypeChange={onNewBusinessTypeChange}
            onNewBusinessCategoryChange={onNewBusinessCategoryChange}
            onNewStateChange={onNewStateChange}
            onNewPincodeChange={onNewPincodeChange}
            onNewAddressChange={onNewAddressChange}
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
