import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { Checkbox } from "../../design-system/atoms/Checkbox";
import { IconButton } from "../../design-system/atoms/IconButton";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../../design-system/molecules/DenseTable";
import {
  hasAssignedStoreCapability,
  useSessionStore,
  type BusinessCapability,
} from "../../features/auth/session-business";
import { syncOnce, type CustomerRow } from "../../features/sync/engine";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const DENSE_INPUT_CLASS = "h-8 rounded-xl px-3 text-xs";

type PartyListRow = CustomerRow;

type PeopleListPageProps = {
  title: string;
  description: string;
  singularLabel: string;
  pluralLabel: string;
  addLabel: string;
  addPath: string;
  detailBasePath: string;
  messageStateKey: string;
  loadPrimaryRows: (tenantId: string) => Promise<PartyListRow[]>;
  toUserErrorMessage: (error: unknown) => string;
  secondaryRole?: {
    capability: BusinessCapability;
    label: string;
    headerLabel: string;
    loadRows: (tenantId: string) => Promise<PartyListRow[]>;
    addRole: (tenantId: string, userId: string, row: PartyListRow) => Promise<void>;
    removeRole: (tenantId: string, userId: string, entityId: string) => Promise<void>;
    addMessage: (name: string, isOffline: boolean) => string;
    removeMessage: (name: string, isOffline: boolean) => string;
  };
};

export function PeopleListPage({
  title,
  description,
  singularLabel,
  pluralLabel,
  addLabel,
  addPath,
  detailBasePath,
  messageStateKey,
  loadPrimaryRows,
  toUserErrorMessage,
  secondaryRole,
}: PeopleListPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [rows, setRows] = useState<PartyListRow[]>([]);
  const [secondaryRoleIds, setSecondaryRoleIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [roleMutationId, setRoleMutationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);
  const activeBusiness =
    businesses.find((business) => business.id === activeStore) ?? null;
  const canManageSecondaryRole =
    secondaryRole ? hasAssignedStoreCapability(activeBusiness, secondaryRole.capability) : false;

  const normalizedQuery = (query.trim().length === 0 ? "" : debouncedQuery).trim().toLowerCase();
  const locationState = location.state as Record<string, unknown> | null;
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!normalizedQuery) return true;
        return [row.name, row.phone, row.email, row.gstNo].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      }),
    [normalizedQuery, rows],
  );

  useEffect(() => {
    const nextMessage = locationState?.[messageStateKey];
    if (typeof nextMessage !== "string" || nextMessage.length === 0) {
      return;
    }

    setMessage(nextMessage);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, locationState, messageStateKey, navigate]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setRows([]);
      setSecondaryRoleIds(new Set());
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [primaryRows, secondaryRows] = await Promise.all([
          loadPrimaryRows(activeStore),
          secondaryRole && canManageSecondaryRole
            ? secondaryRole.loadRows(activeStore)
            : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setRows(primaryRows);
          setSecondaryRoleIds(new Set(secondaryRows.map((row) => row.entityId)));
        }
        await syncOnce(activeStore);
        if (!cancelled) {
          const [reloadedPrimaryRows, reloadedSecondaryRows] = await Promise.all([
            loadPrimaryRows(activeStore),
            secondaryRole && canManageSecondaryRole
              ? secondaryRole.loadRows(activeStore)
              : Promise.resolve([]),
          ]);
          setRows(reloadedPrimaryRows);
          setSecondaryRoleIds(new Set(reloadedSecondaryRows.map((row) => row.entityId)));
          setError(null);
        }
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError(toUserErrorMessage(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeStore, canManageSecondaryRole, isBusinessSelected, loadPrimaryRows, secondaryRole, toUserErrorMessage]);

  const refreshRows = async () => {
    if (!activeStore || !isBusinessSelected || loading) {
      return;
    }

    setLoading(true);
    try {
      await syncOnce(activeStore);
      const [primaryRows, secondaryRows] = await Promise.all([
        loadPrimaryRows(activeStore),
        secondaryRole && canManageSecondaryRole
          ? secondaryRole.loadRows(activeStore)
          : Promise.resolve([]),
      ]);
      setRows(primaryRows);
      setSecondaryRoleIds(new Set(secondaryRows.map((row) => row.entityId)));
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(toUserErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const onToggleSecondaryRole = async (row: PartyListRow, checked: boolean) => {
    if (
      !secondaryRole ||
      !activeStore ||
      !identityId ||
      !isBusinessSelected ||
      loading ||
      roleMutationId ||
      !canManageSecondaryRole
    ) {
      return;
    }

    const alreadyLinked = secondaryRoleIds.has(row.entityId);
    if (checked === alreadyLinked) {
      return;
    }

    setRoleMutationId(row.entityId);
    setError(null);

    try {
      if (checked) {
        await secondaryRole.addRole(activeStore, identityId, row);
      } else {
        await secondaryRole.removeRole(activeStore, identityId, row.entityId);
      }
      await syncOnce(activeStore);
      const [primaryRows, secondaryRows] = await Promise.all([
        loadPrimaryRows(activeStore),
        secondaryRole.loadRows(activeStore),
      ]);
      setRows(primaryRows);
      setSecondaryRoleIds(new Set(secondaryRows.map((nextRow) => nextRow.entityId)));
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      setMessage(
        checked
          ? secondaryRole.addMessage(row.name, isOffline)
          : secondaryRole.removeMessage(row.name, isOffline),
      );
    } catch (nextError) {
      console.error(nextError);
      setError(toUserErrorMessage(nextError));
    } finally {
      setRoleMutationId(null);
    }
  };

  const openDetails = (entityId: string) => {
    setError(null);
    setMessage(null);
    navigate(`${detailBasePath}/${entityId}`);
  };

  return (
    <section className="h-auto w-full lg:h-full lg:min-h-0">
      <Card className="h-auto w-full p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5 lg:shrink-0 lg:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription className="text-[11px] lg:text-[10px]">
                {description}
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={() => navigate(addPath)}
              disabled={!activeStore || !isBusinessSelected || loading}
            >
              {addLabel}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <fieldset className="app-filter-panel lg:shrink-0">
            <legend className="app-filter-legend">Filters</legend>
            <p className="app-filter-help">
              Refine {pluralLabel.toLowerCase()} by search text and sync the latest local records.
            </p>
            <Label
              htmlFor={`${singularLabel.toLowerCase()}-search`}
              className="text-[11px] font-medium lg:text-[10px]"
            >
              Search {pluralLabel.toLowerCase()}
            </Label>
            <div className="app-filter-row">
              <Input
                id={`${singularLabel.toLowerCase()}-search`}
                className={`${DENSE_INPUT_CLASS} w-full min-[642px]:flex-1 min-[642px]:min-w-[12rem]`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={loading}
                placeholder="Name, phone, email, or GST"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full min-[642px]:w-auto"
                onClick={() => setQuery("")}
                disabled={loading || query.length === 0}
              >
                Clear Search
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full min-[642px]:w-auto"
                onClick={() => {
                  void refreshRows();
                }}
                disabled={!activeStore || !isBusinessSelected || loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </fieldset>

          <div className="space-y-2 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:pr-1">
            {error ? <div className="card text-sm text-red-600">{error}</div> : null}
            {loading ? (
              <div className="card text-sm text-muted-foreground">
                Loading {pluralLabel.toLowerCase()}...
              </div>
            ) : rows.length === 0 ? (
              <div className="card text-sm text-muted-foreground">
                No {pluralLabel.toLowerCase()} available.
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="card text-sm text-muted-foreground">
                No {pluralLabel.toLowerCase()} match your current search.
              </div>
            ) : (
              <>
                <div className="space-y-2 lg:hidden">
                  {filteredRows.map((row) => {
                    const hasSecondaryRole = secondaryRoleIds.has(row.entityId);
                    return (
                      <div
                        key={row.entityId}
                        className="rounded-xl border border-border/70 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{row.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.phone || row.email || "No contact details"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              GST: {row.gstNo || "-"}
                            </p>
                            {row.address ? (
                              <p className="text-[11px] text-muted-foreground">
                                Address: {row.address}
                              </p>
                            ) : null}
                            {secondaryRole && canManageSecondaryRole ? (
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Checkbox
                                  aria-label={`Also use ${row.name} as a ${secondaryRole.label.toLowerCase()}`}
                                  checked={hasSecondaryRole}
                                  disabled={loading || roleMutationId === row.entityId || !identityId}
                                  onChange={(event) => {
                                    void onToggleSecondaryRole(row, event.target.checked);
                                  }}
                                />
                                <span>{secondaryRole.headerLabel}</span>
                              </div>
                            ) : null}
                          </div>
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              row.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openDetails(row.entityId)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <DenseTable className="hidden lg:block">
                  <DenseTableHead>
                    <DenseTableRow>
                      <DenseTableHeaderCell className="w-[22%]">Name</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[16%]">Phone</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[20%]">Email</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[18%]">Address</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[10%]">GST No</DenseTableHeaderCell>
                      {secondaryRole && canManageSecondaryRole ? (
                        <DenseTableHeaderCell className="w-[10%]">
                          {secondaryRole.headerLabel}
                        </DenseTableHeaderCell>
                      ) : null}
                      <DenseTableHeaderCell className="w-[8%]">Status</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[8%] text-right">Actions</DenseTableHeaderCell>
                    </DenseTableRow>
                  </DenseTableHead>
                  <DenseTableBody>
                    {filteredRows.map((row) => {
                      const hasSecondaryRole = secondaryRoleIds.has(row.entityId);
                      return (
                        <DenseTableRow key={row.entityId} className="hover:bg-slate-50">
                          <DenseTableCell className="font-medium text-foreground">
                            {row.name}
                          </DenseTableCell>
                          <DenseTableCell className="truncate text-muted-foreground">
                            {row.phone || "-"}
                          </DenseTableCell>
                          <DenseTableCell className="truncate text-muted-foreground">
                            {row.email || "-"}
                          </DenseTableCell>
                          <DenseTableCell className="truncate text-muted-foreground">
                            {row.address || "-"}
                          </DenseTableCell>
                          <DenseTableCell className="truncate text-muted-foreground">
                            {row.gstNo || "-"}
                          </DenseTableCell>
                          {secondaryRole && canManageSecondaryRole ? (
                            <DenseTableCell className="px-2 py-2.5">
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Checkbox
                                  aria-label={`Also use ${row.name} as a ${secondaryRole.label.toLowerCase()}`}
                                  checked={hasSecondaryRole}
                                  disabled={loading || roleMutationId === row.entityId || !identityId}
                                  onChange={(event) => {
                                    void onToggleSecondaryRole(row, event.target.checked);
                                  }}
                                />
                                <span>{hasSecondaryRole ? "Yes" : "No"}</span>
                              </div>
                            </DenseTableCell>
                          ) : null}
                          <DenseTableCell className="px-2 py-2.5">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                row.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {row.isActive ? "Active" : "Inactive"}
                            </span>
                          </DenseTableCell>
                          <DenseTableCell>
                            <div className="flex justify-end">
                              <IconButton
                                type="button"
                                icon={Eye}
                                variant="ghost"
                                onClick={() => openDetails(row.entityId)}
                                className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                                aria-label={`View details for ${row.name}`}
                                title="View details"
                              />
                            </div>
                          </DenseTableCell>
                        </DenseTableRow>
                      );
                    })}
                  </DenseTableBody>
                </DenseTable>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      {message ? (
        <div className="pointer-events-none fixed right-3 top-3 z-40 max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm">
          {message}
        </div>
      ) : null}
      <div className="fixed bottom-[5.25rem] right-3 z-30 lg:hidden">
        <Button
          type="button"
          size="sm"
          className="h-10 px-4 shadow-sm"
          onClick={() => navigate(addPath)}
          disabled={!activeStore || !isBusinessSelected || loading}
        >
          {addLabel}
        </Button>
      </div>
    </section>
  );
}
