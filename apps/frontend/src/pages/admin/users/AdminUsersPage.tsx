import { Eye, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../design-system/atoms/Button";
import { IconButton } from "../../../design-system/atoms/IconButton";
import { Input } from "../../../design-system/atoms/Input";
import { Label } from "../../../design-system/atoms/Label";
import {
  Card,
  CardContent,
} from "../../../design-system/molecules/Card";
import {
  listAdminUsers,
  type AdminUser,
  type AdminUsersPagination,
} from "../../../features/admin/users";

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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<AdminUsersPagination>(initialPagination);
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterIncludeDeleted, setFilterIncludeDeleted] = useState(false);
  const filterReadyRef = useRef(false);

  const requestUsers = useCallback(
    async (
      targetPage = page,
      filters: UserFilters = {
        name: filterName,
        phone: filterPhone,
        email: filterEmail,
        includeDeleted: filterIncludeDeleted,
      },
    ) => {
      return listAdminUsers({
        name: filters.name,
        phone: filters.phone,
        email: filters.email,
        includeDeleted: filters.includeDeleted,
        page: targetPage,
        limit: 10,
      });
    },
    [filterEmail, filterIncludeDeleted, filterName, filterPhone, page],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
    void requestUsers(1)
      .then((result) => {
        setUsers(result.users);
        setPage(result.pagination.page);
        setPagination(result.pagination);
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load users",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [requestUsers]);

  useEffect(() => {
    if (!filterReadyRef.current) {
      filterReadyRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void requestUsers(1, {
        name: filterName,
        phone: filterPhone,
        email: filterEmail,
        includeDeleted: filterIncludeDeleted,
      })
        .then((result) => {
          setUsers(result.users);
          setPage(result.pagination.page);
          setPagination(result.pagination);
        })
        .catch((requestError) => {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load users",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filterEmail, filterIncludeDeleted, filterName, filterPhone, requestUsers]);

  const onClearFilters = () => {
    setFilterName("");
    setFilterPhone("");
    setFilterEmail("");
    setFilterIncludeDeleted(false);
    setLoading(true);
    setError(null);
    void requestUsers(1, {
      name: "",
      phone: "",
      email: "",
      includeDeleted: false,
    })
      .then((result) => {
        setUsers(result.users);
        setPage(result.pagination.page);
        setPagination(result.pagination);
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load users",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const onReload = () => {
    setLoading(true);
    setError(null);
    void requestUsers(page)
      .then((result) => {
        setUsers(result.users);
        setPage(result.pagination.page);
        setPagination(result.pagination);
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load users",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <section className="h-auto lg:h-full lg:min-h-0">
      <Card className="h-auto lg:h-full lg:min-h-0">
        <CardContent className="space-y-2 lg:h-full lg:min-h-0 lg:overflow-y-auto">
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
                  <button
                    id="include-deleted-users"
                    type="button"
                    role="switch"
                    aria-checked={filterIncludeDeleted}
                    aria-label="Include deleted users"
                    onClick={() => setFilterIncludeDeleted((current) => !current)}
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
                  className={`rounded-2xl border p-3 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-transform duration-150 hover:-translate-y-0.5 ${
                    isDeleted
                      ? "border-[#f3c3c0] bg-[#fff5f5]"
                      : "border-white/80 bg-white/75"
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

          <div className="hidden overflow-x-auto rounded-2xl border border-white/70 bg-white/60 min-[860px]:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/70 bg-white/70 text-left text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">User</th>
                  <th className="px-3 py-2 font-semibold">Phone</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Businesses</th>
                  <th className="px-3 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isDeleted = Boolean(user.deletedAt);
                  return (
                    <tr
                      key={user.id}
                      className={`h-9 border-b border-white/60 align-middle transition-colors last:border-b-0 ${
                        isDeleted ? "bg-[#fff7f7]" : "hover:bg-white/70"
                      }`}
                    >
                      <td className="px-3 py-0 align-middle font-semibold">
                        {user.name?.trim() || "Unnamed user"}
                      </td>
                      <td className="px-3 py-0 align-middle">{user.phone || "-"}</td>
                      <td className="px-3 py-0 align-middle">{user.email || "-"}</td>
                      <td className="px-3 py-0 align-middle">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isDeleted
                              ? "bg-[#fce8e8] text-[#8a2b2b]"
                              : "bg-[#e8f2ff] text-[#24507e]"
                          }`}
                        >
                          {isDeleted ? "Deleted" : user.systemRole}
                        </span>
                      </td>
                      <td className="px-3 py-0 align-middle">{user.businessCount}</td>
                      <td className="px-3 py-0 align-middle">
                        <div className="flex justify-end">
                          <IconButton
                            icon={Eye}
                            variant="ghost"
                            onClick={() => navigate(`/app/users/${user.id}`)}
                            disabled={loading}
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                            aria-label={`View details for ${user.name?.trim() || "Unnamed user"}`}
                            title="View details"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {users.length === 0 ? (
            <div className="rounded-2xl border border-white/70 bg-white/55 p-3">
              <p className="px-0 text-sm text-muted-foreground">No users found.</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/55 p-3">
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
