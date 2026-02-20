import { Button } from "../atoms/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../molecules/Card";
import type {
  AdminStore,
  AdminStoresPagination,
} from "../../features/admin/stores";
import { StoreManagementCreateView } from "./StoreManagementCreateView";
import { StoreManagementListView } from "./StoreManagementListView";

type StoreManagementPanelProps = {
  mode: "list" | "new";
  stores: AdminStore[];
  page: number;
  pagination: AdminStoresPagination;
  filterStoreName: string;
  filterOwnerPhone: string;
  filterIncludeDeleted: boolean;
  loading: boolean;
  error: string | null;
  newStoreName: string;
  newOwnerPhone: string;
  onFilterStoreNameChange: (value: string) => void;
  onFilterOwnerPhoneChange: (value: string) => void;
  onFilterIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onNewStoreNameChange: (value: string) => void;
  onNewOwnerPhoneChange: (value: string) => void;
  onCreate: () => void;
  onOpenStore: (store: AdminStore) => void;
  onReload: () => void;
  onOpenCreate: () => void;
  onBackToList: () => void;
};

export function StoreManagementPanel({
  mode,
  stores,
  page,
  pagination,
  filterStoreName,
  filterOwnerPhone,
  filterIncludeDeleted,
  loading,
  error,
  newStoreName,
  newOwnerPhone,
  onFilterStoreNameChange,
  onFilterOwnerPhoneChange,
  onFilterIncludeDeletedChange,
  onClearFilters,
  onPrevPage,
  onNextPage,
  onNewStoreNameChange,
  onNewOwnerPhoneChange,
  onCreate,
  onOpenStore,
  onReload,
  onOpenCreate,
  onBackToList,
}: StoreManagementPanelProps) {
  const isListView = mode === "list";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{isListView ? "Manage Stores" : "Add Store"}</CardTitle>
            <CardDescription>
              {isListView
                ? "Browse, edit, and remove stores as a platform admin."
                : "Create a new store by looking up the owner using phone."}
            </CardDescription>
          </div>
          {isListView ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCreate}
              className="mt-8 md:mt-10"
              aria-label="Add new store"
              title="Add new store"
            >
              Add Store
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isListView ? (
          <StoreManagementListView
            stores={stores}
            page={page}
            pagination={pagination}
            filterStoreName={filterStoreName}
            filterOwnerPhone={filterOwnerPhone}
            filterIncludeDeleted={filterIncludeDeleted}
            loading={loading}
            error={error}
            onFilterStoreNameChange={onFilterStoreNameChange}
            onFilterOwnerPhoneChange={onFilterOwnerPhoneChange}
            onFilterIncludeDeletedChange={onFilterIncludeDeletedChange}
            onClearFilters={onClearFilters}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
            onOpenStore={onOpenStore}
            onReload={onReload}
          />
        ) : (
          <StoreManagementCreateView
            loading={loading}
            error={error}
            newStoreName={newStoreName}
            newOwnerPhone={newOwnerPhone}
            onNewStoreNameChange={onNewStoreNameChange}
            onNewOwnerPhoneChange={onNewOwnerPhoneChange}
            onCreate={onCreate}
            onBackToList={onBackToList}
          />
        )}
      </CardContent>
    </Card>
  );
}
