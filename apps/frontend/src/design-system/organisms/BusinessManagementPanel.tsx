import { Button } from "../atoms/Button";
import { LoadingOverlay } from "../atoms/LoadingOverlay";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  onFilterBusinessNameChange: (value: string) => void;
  onFilterOwnerPhoneChange: (value: string) => void;
  onFilterIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onNewBusinessNameChange: (value: string) => void;
  onNewOwnerPhoneChange: (value: string) => void;
  onCreate: () => void;
  onOpenStore: (business: AdminStore) => void;
  onReload: () => void;
  onOpenCreate: () => void;
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
  onFilterBusinessNameChange,
  onFilterOwnerPhoneChange,
  onFilterIncludeDeletedChange,
  onClearFilters,
  onPrevPage,
  onNextPage,
  onNewBusinessNameChange,
  onNewOwnerPhoneChange,
  onCreate,
  onOpenStore,
  onReload,
  onOpenCreate,
  onBackToList,
}: BusinessManagementPanelProps) {
  const isListView = mode === "list";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{isListView ? "Manage Businesses" : "Add Business"}</CardTitle>
            <CardDescription>
              {isListView
                ? "Browse, edit, and remove businesses as a platform admin."
                : "Create a new business by looking up the owner using phone."}
            </CardDescription>
          </div>
          {isListView ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCreate}
              aria-label="Add new business"
              title="Add new business"
            >
              Add Business
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={`relative ${isListView ? "space-y-0" : "space-y-4"}`}>
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
            onNewBusinessNameChange={onNewBusinessNameChange}
            onNewOwnerPhoneChange={onNewOwnerPhoneChange}
            onCreate={onCreate}
            onBackToList={onBackToList}
          />
        )}
        <LoadingOverlay visible={loading} label="Updating businesses" />
      </CardContent>
    </Card>
  );
}
