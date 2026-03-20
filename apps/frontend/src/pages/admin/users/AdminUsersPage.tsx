import { Eye, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../design-system/atoms/Button";
import { IconButton } from "../../../design-system/atoms/IconButton";
import { Input } from "../../../design-system/atoms/Input";
import { Label } from "../../../design-system/atoms/Label";
import { Switch } from "../../../design-system/atoms/Switch";
import {
  Card,
  CardContent,
} from "../../../design-system/molecules/Card";
import {
  TabularBody,
  TabularCell,
  TabularHeader,
  TabularRow,
  TabularSurface,
} from "../../../design-system/molecules/TabularSurface";
import {
  listAdminUsers,
  type AdminUser,
  type AdminUsersPagination,
} from "../../../features/admin/users";
import { useDebouncedValue } from "../../../lib/useDebouncedValue";

const initialPagination: AdminUsersPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

type UserFilters = {
  name: string;
  phone: string;
  email: string;
  includeDeleted: boolean;
};

export function AdminUsersPage() {
  const navigate = useNavigate();
  const desktopGridTemplate =
    "minmax(0,2fr) minmax(0,1.4fr) minmax(0,2fr) minmax(0,1.1fr) minmax(0,0.9fr) 3rem";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<AdminUsersPagination>(initialPagination);
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterIncludeDeleted, setFilterIncludeDeleted] = useState(false);
  const debouncedFilterName = useDebouncedValue(filterName, 300);
  const debouncedFilterPhone = useDebouncedValue(filterPhone, 300);
  const debouncedFilterEmail = useDebouncedValue(filterEmail, 300);
  const appliedFilterName = (filterName.trim().length === 0 ? "" : debouncedFilterName).trim();
  const appliedFilterPhone = (filterPhone.trim().length === 0 ? "" : debouncedFilterPhone).trim();
  const appliedFilterEmail = (filterEmail.trim().length === 0 ? "" : debouncedFilterEmail).trim();

  const requestUsers = useCallback(async (targetPage: number, filters: UserFilters) => {
    return listAdminUsers({
      name: filters.name,
      phone: filters.phone,
      email: filters.email,
      includeDeleted: filters.includeDeleted,
      page: targetPage,
      limit: 10,
    });
  }, []);

  const runUserRequest = useCallback(
    async (targetPage: number, filters: UserFilters) => {
      setLoading(true);
      setError(null);
      try {
        const result = await requestUsers(targetPage, filters);
        setUsers(result.users);
        setPage(result.pagination.page);
        setPagination(result.pagination);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load users",
        );
      } finally {
        setLoading(false);
      }
    },
    [requestUsers],
  );

  useEffect(() => {
    void runUserRequest(1, {
      name: appliedFilterName,
      phone: appliedFilterPhone,
      email: appliedFilterEmail,
      includeDeleted: filterIncludeDeleted,
    });
  }, [
    appliedFilterEmail,
    appliedFilterName,
    appliedFilterPhone,
    filterIncludeDeleted,
    runUserRequest,
  ]);

  const onClearFilters = () => {
    setFilterName("");
    setFilterPhone("");
    setFilterEmail("");
    setFilterIncludeDeleted(false);
    setError(null);
  };

  const onReload = () => {
    void runUserRequest(page, {
      name: appliedFilterName,
      phone: appliedFilterPhone,
      email: appliedFilterEmail,
      includeDeleted: filterIncludeDeleted,
    });
  };

  const loadUsers = async (targetPage: number) => {
    await runUserRequest(targetPage, {
      name: appliedFilterName,
      phone: appliedFilterPhone,
      email: appliedFilterEmail,
      includeDeleted: filterIncludeDeleted,
    });
  };

  return (
    <section className="h-auto lg:h-full lg:min-h-0">
      <Card className="h-auto lg:h-full lg:min-h-0">
        <CardContent className="space-y-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
          <fieldset className="app-filter-panel">
            <legend className="app-filter-legend">
              Filters
            </legend>
            <p className="app-filter-help">
              Refine users by name, phone, and email.
            </p>
            <div className="app-filter-row">
              <Input
                className="w-full min-[642px]:flex-1 min-[642px]:min-w-[12rem]"
                value={filterName}
                onChange={(event) => setFilterName(event.target.value)}
                placeholder="Name"
              />
              <Input
                className="w-full min-[642px]:flex-1 min-[642px]:min-w-[10rem]"
                value={filterPhone}
                onChange={(event) => setFilterPhone(event.target.value)}
                placeholder="Phone"
              />
              <Input
                className="w-full min-[642px]:flex-1 min-[642px]:min-w-[12rem]"
                value={filterEmail}
                onChange={(event) => setFilterEmail(event.target.value)}
                placeholder="Email"
              />
              <div className="flex w-full flex-col gap-1.5 min-[642px]:w-auto min-[642px]:flex-row min-[642px]:items-center min-[642px]:gap-2">
                <div className="inline-flex items-center gap-2">
                  <Switch
                    id="include-deleted-users"
                    aria-label="Include deleted users"
                    checked={filterIncludeDeleted}
                    onCheckedChange={setFilterIncludeDeleted}
                    disabled={loading}
                    className="h-6 w-11 border"
                    checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                    uncheckedTrackClassName="border-[#b8cbe0] bg-[#e7eff8]"
                  />
                  <Label htmlFor="include-deleted-users" className="shrink-0">
                    Include deleted
                  </Label>
                </div>
                <div className="flex w-full gap-1.5 min-[642px]:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onClearFilters}
                    disabled={loading}
                    className="h-7 flex-1 gap-1 px-2 text-[11px] min-[642px]:h-6 min-[642px]:flex-none"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear Filters
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onReload}
                    disabled={loading}
                    className="h-7 flex-1 gap-1 px-2 text-[11px] min-[642px]:h-6 min-[642px]:flex-none"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reload Data
                  </Button>
                </div>
              </div>
            </div>
          </fieldset>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="space-y-2 min-[860px]:hidden">
            {users.map((user) => {
              const isDeleted = Boolean(user.deletedAt);
              const displayName = user.name?.trim() || "Unnamed user";
              return (
                <div
                  key={user.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/app/users/${user.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/app/users/${user.id}`);
                    }
                  }}
                  className={`rounded-xl border p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_20px_-18px_rgba(15,23,42,0.18)] transition-transform duration-150 hover:-translate-y-0.5 ${
                    isDeleted
                      ? "border-[#f3c3c0] bg-[#fff5f5]"
                      : "border-border/80 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {displayName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {user.phone || "-"} {user.email ? `| ${user.email}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isDeleted
                          ? "bg-[#fce8e8] text-[#8a2b2b]"
                          : "bg-[#e8f2ff] text-[#24507e]"
                      }`}
                    >
                      {isDeleted ? "Deleted" : user.systemRole}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Businesses: {user.businessCount}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="hidden min-[860px]:flex min-[860px]:min-h-0 min-[860px]:flex-1 min-[860px]:flex-col">
            <TabularSurface className="min-h-0 flex-1 overflow-hidden bg-white">
              <TabularHeader>
                <TabularRow columns={desktopGridTemplate}>
                  <TabularCell variant="header">User</TabularCell>
                  <TabularCell variant="header">Phone</TabularCell>
                  <TabularCell variant="header">Email</TabularCell>
                  <TabularCell variant="header">Role</TabularCell>
                  <TabularCell variant="header">Businesses</TabularCell>
                  <TabularCell variant="header" align="center">Action</TabularCell>
                </TabularRow>
              </TabularHeader>
              <TabularBody className="overflow-y-auto">
                {users.map((user) => {
                  const isDeleted = Boolean(user.deletedAt);
                  const displayName = user.name?.trim() || "Unnamed user";
                  return (
                    <TabularRow
                      key={user.id}
                      columns={desktopGridTemplate}
                      interactive
                      className={isDeleted ? "bg-[#fff7f7]" : undefined}
                    >
                      <TabularCell className="font-semibold" truncate hoverTitle={displayName}>
                        {displayName}
                      </TabularCell>
                      <TabularCell truncate hoverTitle={user.phone || "-"}>
                        {user.phone || "-"}
                      </TabularCell>
                      <TabularCell truncate hoverTitle={user.email || "-"}>
                        {user.email || "-"}
                      </TabularCell>
                      <TabularCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isDeleted
                              ? "bg-[#fce8e8] text-[#8a2b2b]"
                              : "bg-[#e8f2ff] text-[#24507e]"
                          }`}
                        >
                          {isDeleted ? "Deleted" : user.systemRole}
                        </span>
                      </TabularCell>
                      <TabularCell>{user.businessCount}</TabularCell>
                      <TabularCell align="center">
                        <div className="inline-flex">
                          <IconButton
                            icon={Eye}
                            variant="ghost"
                            onClick={() => navigate(`/app/users/${user.id}`)}
                            disabled={loading}
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                            aria-label={`View details for ${displayName}`}
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

          {users.length === 0 ? (
            <div className="rounded-xl border border-border/80 bg-white p-3">
              <p className="px-0 text-sm text-muted-foreground">No users found.</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-white p-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {Math.max(pagination.totalPages, 1)} | Total users:{" "}
              {pagination.total}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadUsers(Math.max(1, page - 1))}
                disabled={loading || page <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadUsers(page + 1)}
                disabled={
                  loading || page >= pagination.totalPages || pagination.totalPages === 0
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
