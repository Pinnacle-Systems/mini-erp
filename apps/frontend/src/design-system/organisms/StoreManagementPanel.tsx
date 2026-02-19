import { Pencil, Trash2 } from "lucide-react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
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

type StoreManagementPanelProps = {
  mode: "list" | "new";
  stores: AdminStore[];
  page: number;
  pagination: AdminStoresPagination;
  filterStoreName: string;
  filterOwnerEmail: string;
  filterOwnerPhone: string;
  loading: boolean;
  error: string | null;
  newStoreName: string;
  newOwnerEmail: string;
  newOwnerPhone: string;
  editStoreId: string | null;
  editStoreName: string;
  editOwnerId: string;
  onFilterStoreNameChange: (value: string) => void;
  onFilterOwnerEmailChange: (value: string) => void;
  onFilterOwnerPhoneChange: (value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onNewStoreNameChange: (value: string) => void;
  onNewOwnerEmailChange: (value: string) => void;
  onNewOwnerPhoneChange: (value: string) => void;
  onCreate: () => void;
  onStartEdit: (store: AdminStore) => void;
  onCancelEdit: () => void;
  onEditStoreNameChange: (value: string) => void;
  onEditOwnerIdChange: (value: string) => void;
  onSaveEdit: () => void;
  onDelete: (storeId: string) => void;
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
  filterOwnerEmail,
  filterOwnerPhone,
  loading,
  error,
  newStoreName,
  newOwnerEmail,
  newOwnerPhone,
  editStoreId,
  editStoreName,
  editOwnerId,
  onFilterStoreNameChange,
  onFilterOwnerEmailChange,
  onFilterOwnerPhoneChange,
  onApplyFilters,
  onClearFilters,
  onPrevPage,
  onNextPage,
  onNewStoreNameChange,
  onNewOwnerEmailChange,
  onNewOwnerPhoneChange,
  onCreate,
  onStartEdit,
  onCancelEdit,
  onEditStoreNameChange,
  onEditOwnerIdChange,
  onSaveEdit,
  onDelete,
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
                : "Create a new store by looking up the owner using email or phone."}
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
          <>
            <div className="rounded-2xl border border-white/70 bg-white/55 p-3">
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  value={filterStoreName}
                  onChange={(event) =>
                    onFilterStoreNameChange(event.target.value)
                  }
                  placeholder="Store name"
                />
                <Input
                  value={filterOwnerEmail}
                  onChange={(event) =>
                    onFilterOwnerEmailChange(event.target.value)
                  }
                  placeholder="Owner email"
                />
                <Input
                  value={filterOwnerPhone}
                  onChange={(event) =>
                    onFilterOwnerPhoneChange(event.target.value)
                  }
                  placeholder="Owner phone"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onApplyFilters}
                  disabled={loading}
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClearFilters}
                  disabled={loading}
                >
                  Clear Filters
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReload}
                  disabled={loading}
                >
                  Reload
                </Button>
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stores.map((store) => {
                const isEditing = editStoreId === store.id;
                return (
                  <div
                    key={store.id}
                    className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-transform duration-150 hover:-translate-y-0.5"
                  >
                    {isEditing ? (
                      <div className="grid gap-3">
                        <Input
                          value={editStoreName}
                          onChange={(event) =>
                            onEditStoreNameChange(event.target.value)
                          }
                          placeholder="Store name"
                          disabled={loading}
                        />
                        <Input
                          value={editOwnerId}
                          onChange={(event) =>
                            onEditOwnerIdChange(event.target.value)
                          }
                          placeholder="Owner ID"
                          disabled={loading}
                        />
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {store.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {store.owner?.email ??
                            store.owner?.phone ??
                            "Owner contact unavailable"}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={onSaveEdit}
                            disabled={
                              loading ||
                              !editStoreName.trim() ||
                              !editOwnerId.trim()
                            }
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onCancelEdit}
                            disabled={loading}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onStartEdit(store)}
                            disabled={loading}
                            className="h-8 w-8 rounded-full p-0 text-[#1f4167] hover:bg-[#eaf2ff]"
                            aria-label={`Edit ${store.name}`}
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(store.id)}
                            disabled={loading}
                            className="h-8 w-8 rounded-full p-0 text-[#b42318] hover:bg-[#ffecec]"
                            aria-label={`Delete ${store.name}`}
                            title="Delete"
                          >
                            <Trash2 color="red" size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {stores.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stores found.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/55 p-3">
              <p className="text-xs text-muted-foreground">
                Page {page} of {Math.max(pagination.totalPages, 1)} | Total
                stores: {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onPrevPage}
                  disabled={loading || page <= 1}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onNextPage}
                  disabled={
                    loading ||
                    page >= pagination.totalPages ||
                    pagination.totalPages === 0
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-store-name">Store name</Label>
                <Input
                  id="new-store-name"
                  value={newStoreName}
                  onChange={(event) => onNewStoreNameChange(event.target.value)}
                  placeholder="Downtown Outlet"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-owner-email">Owner email</Label>
                <Input
                  id="new-owner-email"
                  value={newOwnerEmail}
                  onChange={(event) =>
                    onNewOwnerEmailChange(event.target.value)
                  }
                  placeholder="owner@example.com"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-owner-phone">Owner phone (primary)</Label>
                <Input
                  id="new-owner-phone"
                  value={newOwnerPhone}
                  onChange={(event) =>
                    onNewOwnerPhoneChange(event.target.value)
                  }
                  placeholder="10 digit phone"
                  disabled={loading}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              If no owner identity exists for the email/phone, a new identity is
              created with the default password.
            </p>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={onCreate}
                disabled={
                  loading ||
                  !newStoreName.trim() ||
                  (!newOwnerEmail.trim() && !newOwnerPhone.trim())
                }
              >
                Create Store
              </Button>
              <Button
                variant="outline"
                onClick={onBackToList}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
