import { Eye, RefreshCw, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../atoms/Button";
import { IconButton } from "../atoms/IconButton";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { Switch } from "../atoms/Switch";
import {
  TabularBody,
  TabularCell,
  TabularHeader,
  TabularRow,
  TabularSurface,
} from "../molecules/TabularSurface";
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
  const desktopGridTemplate =
    "minmax(0,2fr) minmax(0,1.55fr) minmax(0,1.7fr) minmax(0,1.85fr) minmax(0,0.9fr) 3rem";

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
        <fieldset className="app-filter-panel min-[1192px]:order-1 min-[1192px]:flex-1 min-[1192px]:min-w-0">
          <legend className="app-filter-legend">
            Filters
          </legend>
          <p className="app-filter-help">
            Refine the businesses shown below.
          </p>
          <div className="app-filter-row min-[642px]:gap-x-0 min-[642px]:gap-y-1.5 min-[1192px]:gap-y-0">
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
                  <Switch
                    id="include-inactive-businesses"
                    aria-label="Include inactive businesses"
                    checked={filterIncludeDeleted}
                    onCheckedChange={onFilterIncludeDeletedChange}
                    disabled={loading}
                    className="h-6 w-11 border"
                    checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                    uncheckedTrackClassName="border-[#b8cbe0] bg-[#e7eff8]"
                  />
                  <Label htmlFor="include-inactive-businesses" className="shrink-0">
                    Include inactive
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
          const ownerDisplay = business.owner?.name?.trim() || business.owner?.phone || "-";
          const licenseDates = business.license
            ? `${business.license.beginsOn} to ${business.license.endsOn}`
            : "Not configured";
          return (
            <button
              key={business.id}
              type="button"
              onClick={() => onOpenStore(business)}
              className={`w-full rounded-xl border p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_20px_-18px_rgba(15,23,42,0.18)] transition-transform duration-150 hover:-translate-y-0.5 ${
                isDeleted
                  ? "border-[#f3c3c0] bg-[#fff5f5]"
                  : "border-border/80 bg-white"
              }`}
              title={isDeleted ? "Inactive business" : "Open business details"}
              aria-label={`Open business ${business.name}`}
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Owner: {ownerDisplay}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isDeleted
                      ? "bg-[#fce8e8] text-[#8a2b2b]"
                      : "bg-[#e8f2ff] text-[#24507e]"
                  }`}
                >
                  {isDeleted ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                <p>
                  Type/Category: {business.businessType || "-"} / {business.businessCategory || "-"}
                </p>
                <p>License: {licenseDates}</p>
              </div>

            </button>
          );
        })}
      </div>

      <div className="hidden min-[860px]:flex min-[860px]:min-h-0 min-[860px]:flex-1 min-[860px]:flex-col">
        <TabularSurface className="min-h-0 flex-1 overflow-hidden bg-white">
          <TabularHeader>
            <TabularRow columns={desktopGridTemplate}>
              <TabularCell variant="header">Business</TabularCell>
              <TabularCell variant="header">Owner</TabularCell>
              <TabularCell variant="header">Type / Category</TabularCell>
              <TabularCell variant="header">License Dates</TabularCell>
              <TabularCell variant="header">Status</TabularCell>
              <TabularCell variant="header" align="center">Action</TabularCell>
            </TabularRow>
          </TabularHeader>
          <TabularBody className="overflow-y-auto">
          {businesses.map((business) => {
            const isDeleted = Boolean(business.deletedAt);
            const ownerDisplay = business.owner?.name?.trim() || business.owner?.phone || "-";
            const licenseDates = business.license
              ? `${business.license.beginsOn} to ${business.license.endsOn}`
              : "Not configured";
            return (
              <TabularRow
                key={business.id}
                columns={desktopGridTemplate}
                interactive
                className={isDeleted ? "bg-[#fff7f7]" : undefined}
              >
                <TabularCell
                  className={isDeleted ? "font-semibold text-[#8a2b2b]" : "font-semibold"}
                  truncate
                  hoverTitle={business.name}
                >
                  {business.name}
                </TabularCell>
                <TabularCell truncate hoverTitle={ownerDisplay}>
                  {business.ownerId ? (
                    <Link
                      to={`/app/users/${business.ownerId}`}
                      className="text-[#24507e] underline underline-offset-2 transition hover:text-[#1f4167]"
                    >
                      {ownerDisplay}
                    </Link>
                  ) : (
                    <span className="text-foreground/90">{ownerDisplay}</span>
                  )}
                </TabularCell>
                <TabularCell
                  className="text-foreground/90"
                  truncate
                  hoverTitle={`${business.businessType || "-"} / ${business.businessCategory || "-"}`}
                >
                  {(business.businessType || "-") + " / " + (business.businessCategory || "-")}
                </TabularCell>
                <TabularCell className="text-foreground/90" truncate hoverTitle={licenseDates}>
                  {licenseDates}
                </TabularCell>
                <TabularCell>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      isDeleted
                        ? "bg-[#fce8e8] text-[#8a2b2b]"
                        : "bg-[#e8f2ff] text-[#24507e]"
                    }`}
                    >
                      {isDeleted ? "Inactive" : "Active"}
                    </span>
                </TabularCell>
                <TabularCell align="center">
                  <div className="inline-flex">
                    <IconButton
                      icon={Eye}
                      variant="ghost"
                      onClick={() => onOpenStore(business)}
                      disabled={loading}
                      className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                      aria-label={`View details for ${business.name}`}
                      title="View details"
                    />
                  </div>
                </TabularCell>
              </TabularRow>
            );
          })}
          </TabularBody>
        </TabularSurface>
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-xl border border-border/80 bg-white p-3">
          <p className="px-0 text-sm text-muted-foreground">No businesses found.</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-xl border border-border/80 bg-white p-3">
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
