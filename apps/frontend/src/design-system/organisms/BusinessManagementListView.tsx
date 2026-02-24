import { ChevronRight, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import type {
  AdminStore,
  AdminBusinessesPagination,
} from "../../features/admin/businesses";

type BusinessManagementListViewProps = {
  businesses: AdminStore[];
  page: number;
  pagination: AdminBusinessesPagination;
  filterBusinessName: string;
  filterOwnerPhone: string;
  filterIncludeDeleted: boolean;
  loading: boolean;
  error: string | null;
  onFilterBusinessNameChange: (value: string) => void;
  onFilterOwnerPhoneChange: (value: string) => void;
  onFilterIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenStore: (business: AdminStore) => void;
  onReload: () => void;
};

export function BusinessManagementListView({
  businesses,
  page,
  pagination,
  filterBusinessName,
  filterOwnerPhone,
  filterIncludeDeleted,
  loading,
  error,
  onFilterBusinessNameChange,
  onFilterOwnerPhoneChange,
  onFilterIncludeDeletedChange,
  onClearFilters,
  onPrevPage,
  onNextPage,
  onOpenStore,
  onReload,
}: BusinessManagementListViewProps) {
  const navigate = useNavigate();

  const renderModules = (business: AdminStore) => {
    const modules = business.modules;
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
            key={`${business.id}-${moduleName}`}
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
      <div className="flex flex-col gap-2 min-[1192px]:flex-row min-[1192px]:items-center min-[1192px]:gap-2">
        <div className="flex justify-end min-[1192px]:order-2 min-[1192px]:flex-none">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/app/businesses/new")}
            disabled={loading}
            className="h-8 px-2.5 text-[11px]"
          >
            Add Business
          </Button>
        </div>
        <fieldset className="rounded-xl border border-[#c6d8ef] bg-[#f4f8ff] p-2 min-[1192px]:order-1 min-[1192px]:flex-1 min-[1192px]:min-w-0">
          <legend className="rounded-full border border-[#c6d8ef] bg-[#eef5ff] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#35597f]">
            Filters
          </legend>
          <p className="mb-2 text-[11px] leading-tight text-[#4c6e93]">
            Refine the businesses shown below.
          </p>
          <div className="flex w-full flex-col gap-1.5 min-[642px]:flex-row min-[642px]:flex-wrap min-[642px]:items-center min-[642px]:gap-x-0 min-[642px]:gap-y-1.5 min-[1192px]:gap-y-0">
            <Input
              className="w-full min-w-0 min-[642px]:flex-1 min-[642px]:min-w-[12rem] min-[1192px]:w-52 min-[1192px]:flex-none"
              value={filterBusinessName}
              onChange={(event) => onFilterBusinessNameChange(event.target.value)}
              placeholder="Business name"
            />
            <Input
              className="w-full min-w-0 min-[642px]:ml-1 min-[642px]:flex-1 min-[642px]:min-w-[10rem] min-[1192px]:w-44 min-[1192px]:flex-none"
              value={filterOwnerPhone}
              onChange={(event) => onFilterOwnerPhoneChange(event.target.value)}
              placeholder="Owner phone"
            />
            <div className="flex w-full items-center justify-start gap-2 min-[642px]:inline-flex min-[642px]:w-auto min-[1192px]:ml-1 max-[1191px]:basis-full">
              <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <button
                    id="include-deleted-businesses"
                    type="button"
                    role="switch"
                    aria-checked={filterIncludeDeleted}
                    aria-label="Include deleted businesses"
                    onClick={() => onFilterIncludeDeletedChange(!filterIncludeDeleted)}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/35 disabled:cursor-not-allowed disabled:opacity-60 ${
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
                  <Label htmlFor="include-deleted-businesses" className="shrink-0">
                    Include deleted
                  </Label>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onClearFilters}
                  disabled={loading}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear Filters
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReload}
                  disabled={loading}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reload Data
                </Button>
              </div>
            </div>
          </div>
        </fieldset>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2 min-[860px]:hidden">
        {businesses.map((business) => {
          const isDeleted = Boolean(business.deletedAt);
          return (
            <div
              key={business.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenStore(business)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenStore(business);
                }
              }}
              className={`rounded-2xl border p-3 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-transform duration-150 hover:-translate-y-0.5 ${
                isDeleted
                  ? "border-[#f3c3c0] bg-[#fff5f5]"
                  : "border-white/80 bg-white/75"
              }`}
              title={isDeleted ? "Deleted business" : "Open business details"}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-semibold ${
                      isDeleted ? "text-[#8a2b2b]" : "text-foreground"
                    }`}
                  >
                    {business.name}
                  </p>
                  {business.ownerId ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/app/users/${business.ownerId}`);
                      }}
                      className="mt-0.5 text-left text-xs text-[#24507e] underline-offset-2 transition hover:underline"
                    >
                      {business.owner?.name?.trim() || business.owner?.phone || "Unknown owner"}
                    </button>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">Unknown owner</p>
                  )}
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

              <div className="mt-2">{renderModules(business)}</div>

              <div className="mt-2 flex items-center justify-end gap-1.5">
                <IconButton
                  icon={ChevronRight}
                  variant="outline"
                  disabled={loading}
                  className="h-8 w-8 rounded-full border border-[#c6d8ef] bg-[#f4f8ff] p-0 text-[#1f4167] shadow-sm hover:bg-[#eaf2ff]"
                  aria-label={`Open details for ${business.name}`}
                  title="Open details"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/70 bg-white/60 min-[860px]:block">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/70 bg-white/70 text-left text-xs uppercase tracking-[0.05em] text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Business</th>
              <th className="px-3 py-2 font-semibold">Owner</th>
              <th className="px-3 py-2 font-semibold">Modules</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((business) => {
              const isDeleted = Boolean(business.deletedAt);
              return (
                <tr
                  key={business.id}
                  className={`border-b border-white/60 align-top transition-colors last:border-b-0 ${
                    isDeleted ? "bg-[#fff7f7]" : "hover:bg-white/70"
                  }`}
                >
                  <td className="px-3 py-2">
                    <p
                      className={`font-semibold ${
                        isDeleted ? "text-[#8a2b2b]" : "text-foreground"
                      }`}
                    >
                      {business.name}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {business.ownerId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/users/${business.ownerId}`)}
                        className="text-left font-medium text-[#24507e] underline-offset-2 transition hover:underline"
                      >
                        {business.owner?.name?.trim() || business.owner?.phone || "Unknown owner"}
                      </button>
                    ) : (
                      <p className="font-medium text-foreground/90">Unknown owner</p>
                    )}
                  </td>
                  <td className="px-3 py-2">{renderModules(business)}</td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenStore(business)}
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

      {businesses.length === 0 ? (
        <div className="rounded-2xl border border-white/70 bg-white/55 p-3">
          <p className="px-0 text-sm text-muted-foreground">No businesses found.</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/55 p-3">
        <p className="text-xs text-muted-foreground">
          Page {page} of {Math.max(pagination.totalPages, 1)} | Total businesses:{" "}
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
