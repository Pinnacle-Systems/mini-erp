import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
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
import { useSessionStore } from "../../features/auth/session-business";
import {
  getLocalCustomers,
  syncOnce,
  type CustomerRow,
} from "../../features/sync/engine";
import {
  toUserCustomerErrorMessage,
} from "./customer-utils";

const DENSE_INPUT_CLASS = "h-8 rounded-xl px-3 text-xs";

export function CustomersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const locationState =
    location.state as { customerMessage?: string | null } | null;
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!normalizedQuery) return true;
        return [row.name, row.phone, row.email, row.gstNo]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
    [normalizedQuery, rows],
  );

  useEffect(() => {
    if (!locationState?.customerMessage) {
      return;
    }

    setMessage(locationState.customerMessage);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, locationState, navigate]);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const localRows = await getLocalCustomers(activeStore);
        if (!cancelled) {
          setRows(localRows);
        }
        await syncOnce(activeStore);
        const syncedRows = await getLocalCustomers(activeStore);
        if (!cancelled) {
          setRows(syncedRows);
          setError(null);
        }
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError(toUserCustomerErrorMessage(nextError));
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
  }, [activeStore, isBusinessSelected]);

  const refreshRows = async () => {
    if (!activeStore || !isBusinessSelected || loading) {
      return;
    }

    setLoading(true);
    try {
      await syncOnce(activeStore);
      setRows(await getLocalCustomers(activeStore));
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(toUserCustomerErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="h-auto w-full lg:h-full lg:min-h-0">
      <Card className="h-auto w-full p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5 lg:shrink-0 lg:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <CardTitle className="text-sm">Customers</CardTitle>
              <CardDescription className="text-[11px] lg:text-[10px]">
                Manage customer master data from synced customer records.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={() => navigate("/app/customers/new")}
              disabled={!activeStore || !isBusinessSelected || loading}
            >
              Add Customer
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <fieldset className="app-filter-panel lg:shrink-0">
            <legend className="app-filter-legend">Filters</legend>
            <p className="app-filter-help">
              Refine customers by search text and sync the latest local records.
            </p>
            <Label
              htmlFor="customer-search"
              className="text-[11px] font-medium lg:text-[10px]"
            >
              Search customers
            </Label>
            <div className="app-filter-row">
              <Input
                id="customer-search"
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
            {message ? <div className="card text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="card text-sm text-red-600">{error}</div> : null}
            {loading ? (
              <div className="card text-sm text-muted-foreground">Loading customers...</div>
            ) : rows.length === 0 ? (
              <div className="card text-sm text-muted-foreground">No customers available.</div>
            ) : filteredRows.length === 0 ? (
              <div className="card text-sm text-muted-foreground">
                No customers match your current search.
              </div>
            ) : (
              <>
                <div className="space-y-2 lg:hidden">
                  {filteredRows.map((row) => {
                    return (
                      <Button
                        key={row.entityId}
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setError(null);
                          setMessage(null);
                          navigate(`/app/customers/${row.entityId}`);
                        }}
                        className="h-auto w-full justify-start rounded-xl border border-border/70 bg-white p-3 text-left hover:bg-white/90"
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
                      </Button>
                    );
                  })}
                </div>

                <DenseTable className="hidden lg:block">
                  <DenseTableHead>
                    <DenseTableRow>
                      <DenseTableHeaderCell className="w-[32%]">Customer</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[30%]">Contact</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[20%]">Address</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[10%]">GST</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[8%]">Status</DenseTableHeaderCell>
                      <DenseTableHeaderCell className="w-[8%] text-right">Actions</DenseTableHeaderCell>
                    </DenseTableRow>
                  </DenseTableHead>
                  <DenseTableBody>
                    {filteredRows.map((row) => {
                      return (
                        <DenseTableRow key={row.entityId} className="hover:bg-slate-50">
                          <DenseTableCell className="font-medium text-foreground">
                            {row.name}
                          </DenseTableCell>
                          <DenseTableCell className="text-muted-foreground">
                            {row.phone || row.email || "No contact details"}
                          </DenseTableCell>
                          <DenseTableCell className="truncate text-muted-foreground">
                            {row.address || "No address"}
                          </DenseTableCell>
                          <DenseTableCell className="truncate text-muted-foreground">
                            {row.gstNo || "No GST"}
                          </DenseTableCell>
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
                                onClick={() => {
                                  setError(null);
                                  setMessage(null);
                                  navigate(`/app/customers/${row.entityId}`);
                                }}
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
      <div className="fixed bottom-[5.25rem] right-3 z-30 lg:hidden">
        <Button
          type="button"
          size="sm"
          className="h-10 px-4 shadow-sm"
          onClick={() => navigate("/app/customers/new")}
          disabled={!activeStore || !isBusinessSelected || loading}
        >
          Add Customer
        </Button>
      </div>
    </section>
  );
}
