import { ChevronRight, RefreshCw, X } from "lucide-react";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import type {
  AdminStore,
  AdminStoresPagination,
} from "../../features/admin/stores";

type StoreManagementListViewProps = {
  stores: AdminStore[];
  page: number;
  pagination: AdminStoresPagination;
  filterStoreName: string;
  filterOwnerPhone: string;
  filterIncludeDeleted: boolean;
  loading: boolean;
  error: string | null;
  onFilterStoreNameChange: (value: string) => void;
  onFilterOwnerPhoneChange: (value: string) => void;
  onFilterIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenStore: (store: AdminStore) => void;
  onReload: () => void;
};

export function StoreManagementListView({
  stores,
  page,
  pagination,
  filterStoreName,
  filterOwnerPhone,
  filterIncludeDeleted,
  loading,
  error,
  onFilterStoreNameChange,
  onFilterOwnerPhoneChange,
  onFilterIncludeDeletedChange,
  onClearFilters,
  onPrevPage,
  onNextPage,
  onOpenStore,
  onReload,
}: StoreManagementListViewProps) {
  const renderModules = (store: AdminStore) => {
    const modules = store.modules;
    if (!modules) {
      return <span className="text-xs text-muted-foreground">Not configured</span>;
    }

    const enabled = [
      modules.catalog ? "Catalog" : null,
      modules.inventory ? "Inventory" : null,
      modules.pricing ? "Pricing" : null,
    ].filter(Boolean) as string[];

    if (enabled.length === 0) {
      return <span className="text-xs text-muted-foreground">None</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {enabled.map((moduleName) => (
          <span
            key={`${store.id}-${moduleName}`}
            className="rounded-full border border-[#c6d8ef] bg-[#f4f8ff] px-2 py-0.5 text-[11px] font-medium text-[#24486f]"
          >
            {moduleName}
          </span>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="rounded-2xl border border-white/70 bg-white/55 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={filterStoreName}
            onChange={(event) => onFilterStoreNameChange(event.target.value)}
            placeholder="Store name"
          />
          <Input
            value={filterOwnerPhone}
            onChange={(event) => onFilterOwnerPhoneChange(event.target.value)}
            placeholder="Owner phone"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            id="include-deleted-stores"
            type="button"
            role="switch"
            aria-checked={filterIncludeDeleted}
            aria-label="Include deleted stores"
            onClick={() => onFilterIncludeDeletedChange(!filterIncludeDeleted)}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/35 disabled:cursor-not-allowed disabled:opacity-60 ${
              filterIncludeDeleted
                ? "border-[#2f6fb7] bg-[#4a8dd9]"
                : "border-[#b8cbe0] bg-[#e7eff8]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
                filterIncludeDeleted ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <Label htmlFor="include-deleted-stores">Include deleted stores</Label>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <IconButton
            icon={X}
            variant="outline"
            onClick={onClearFilters}
            disabled={loading}
            className="h-8 w-8 rounded-full border border-[#c6d8ef] bg-[#f4f8ff] p-0 text-[#1f4167] shadow-sm hover:bg-[#eaf2ff]"
            aria-label="Clear filters"
            title="Clear filters"
          />
          <IconButton
            icon={RefreshCw}
            variant="outline"
            onClick={onReload}
            disabled={loading}
            className="h-8 w-8 rounded-full border border-[#c6d8ef] bg-[#f4f8ff] p-0 text-[#1f4167] shadow-sm hover:bg-[#eaf2ff]"
            aria-label="Reload stores"
            title="Reload stores"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3 md:hidden">
        {stores.map((store) => {
          const isDeleted = Boolean(store.deletedAt);
          return (
            <div
              key={store.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenStore(store)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenStore(store);
                }
              }}
              className={`rounded-3xl border p-4 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-transform duration-150 hover:-translate-y-0.5 ${
                isDeleted
                  ? "border-[#f3c3c0] bg-[#fff5f5]"
                  : "border-white/80 bg-white/75"
              }`}
              title={isDeleted ? "Deleted store" : "Open store details"}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-semibold ${
                      isDeleted ? "text-[#8a2b2b]" : "text-foreground"
                    }`}
                  >
                    {store.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {store.owner?.phone ?? "Owner phone unavailable"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isDeleted
                      ? "bg-[#fce8e8] text-[#8a2b2b]"
                      : "bg-[#e8f2ff] text-[#24507e]"
                  }`}
                >
                  {isDeleted ? "Deleted" : "Active"}
                </span>
              </div>

              <div className="mt-3">{renderModules(store)}</div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <IconButton
                  icon={ChevronRight}
                  variant="outline"
                  disabled={loading}
                  className="h-8 w-8 rounded-full border border-[#c6d8ef] bg-[#f4f8ff] p-0 text-[#1f4167] shadow-sm hover:bg-[#eaf2ff]"
                  aria-label={`Open details for ${store.name}`}
                  title="Open details"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/70 bg-white/60 md:block">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/70 bg-white/70 text-left text-xs uppercase tracking-[0.05em] text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Store</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Modules</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              const isDeleted = Boolean(store.deletedAt);
              return (
                <tr
                  key={store.id}
                  className={`border-b border-white/60 align-top transition-colors last:border-b-0 ${
                    isDeleted ? "bg-[#fff7f7]" : "hover:bg-white/70"
                  }`}
                >
                  <td className="px-4 py-3">
                    <p
                      className={`font-semibold ${
                        isDeleted ? "text-[#8a2b2b]" : "text-foreground"
                      }`}
                    >
                      {store.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{store.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground/90">
                      {store.owner?.name ?? "Unknown owner"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {store.owner?.phone ?? "Owner phone unavailable"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{renderModules(store)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isDeleted
                          ? "bg-[#fce8e8] text-[#8a2b2b]"
                          : "bg-[#e8f2ff] text-[#24507e]"
                      }`}
                    >
                      {isDeleted ? "Deleted" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenStore(store)}
                        disabled={loading}
                        className="gap-1.5"
                      >
                        Open
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stores.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stores found.</p>
      ) : null}

      <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/55 p-3">
        <p className="text-xs text-muted-foreground">
          Page {page} of {Math.max(pagination.totalPages, 1)} | Total stores:{" "}
          {pagination.total}
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
              loading || page >= pagination.totalPages || pagination.totalPages === 0
            }
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
