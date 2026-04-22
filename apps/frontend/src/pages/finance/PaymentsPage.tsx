import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
import { Textarea } from "../../design-system/atoms/Textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import {
  TabularBody,
  TabularCell,
  TabularHeader,
  TabularRow,
  TabularSerialNumberCell,
  TabularSerialNumberHeaderCell,
  TabularSurface,
} from "../../design-system/molecules/TabularSurface";
import { withTabularSerialNumberColumn } from "../../design-system/molecules/tabularSerialNumbers";
import { useSessionStore } from "../../features/auth/session-business";
import {
  getLocalCustomers,
  getLocalSuppliers,
  type CustomerRow,
  type SupplierRow,
} from "../../features/sync/engine";
import {
  allocatePayment,
  listFinancialAccounts,
  listMoneyMovements,
  listOpenDocuments,
  recordMadePayment,
  recordReceivedPayment,
  voidMoneyMovement,
  type FinancialAccountRow,
  type FinancialDocumentBalanceRow,
  type MoneyMovementRow,
} from "./financial-api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Not posted";

const todayValue = () => new Date().toISOString().slice(0, 10);

const PAYMENT_ROWS_TEMPLATE = withTabularSerialNumberColumn(
  "96px minmax(0,1.1fr) minmax(0,1fr) minmax(0,0.9fr) 88px 88px 96px 72px",
);

const DOCUMENT_ROWS_TEMPLATE = withTabularSerialNumberColumn(
  "minmax(0,1fr) minmax(0,1fr) 96px 104px 120px",
);

type PaymentsPageProps = {
  flow: "RECEIVABLE" | "PAYABLE";
};

type AllocationMode = "MANUAL" | "AUTO" | "ADVANCE";

type PartyOption = {
  id: string;
  name: string;
  secondaryText: string;
};

const clampAllocationInput = (value: string, maxAmount?: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  if (Number.isFinite(maxAmount) && typeof maxAmount === "number" && maxAmount > 0) {
    return String(Math.min(parsed, maxAmount));
  }
  return String(parsed);
};

export function PaymentsPage({ flow }: PaymentsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [accounts, setAccounts] = useState<FinancialAccountRow[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [documents, setDocuments] = useState<FinancialDocumentBalanceRow[]>([]);
  const [movements, setMovements] = useState<MoneyMovementRow[]>([]);
  const [partyId, setPartyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayValue);
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("MANUAL");
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});
  const [applyingMovementId, setApplyingMovementId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestedDocumentApplied, setRequestedDocumentApplied] = useState(false);
  const requestedDocumentId = searchParams.get("documentId") ?? "";
  const requestedMovementId = searchParams.get("movementId") ?? "";
  const requestedMode = searchParams.get("mode") ?? "";

  const paymentLabel = flow === "RECEIVABLE" ? "Receipt" : "Payment";
  const counterpartyLabel = flow === "RECEIVABLE" ? "Customer" : "Supplier";
  const accountLabel = flow === "RECEIVABLE" ? "Received In" : "Paid Via";
  const sourceKind = flow === "RECEIVABLE" ? "PAYMENT_RECEIVED" : "PAYMENT_MADE";
  const allocationModeLabel =
    allocationMode === "AUTO"
      ? "Auto apply oldest first"
      : allocationMode === "ADVANCE"
        ? "Keep as unapplied credit"
        : "Choose invoice amounts yourself";

  const load = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;

    setLoading(true);
    try {
      const [nextAccounts, nextDocuments, nextMovements, nextPartyRows] = await Promise.all([
        listFinancialAccounts(activeStore),
        listOpenDocuments(activeStore, flow, partyId || undefined),
        listMoneyMovements(activeStore, { sourceKind, limit: 50 }),
        flow === "RECEIVABLE" ? getLocalCustomers(activeStore) : getLocalSuppliers(activeStore),
      ]);

      const nextParties = (nextPartyRows as Array<CustomerRow | SupplierRow>)
        .filter((party) => party.isActive && !party.deletedAt)
        .map((party) => ({
          id: party.entityId,
          name: party.name,
          secondaryText: party.phone || party.email || "",
        }));

      setAccounts(nextAccounts);
      setDocuments(nextDocuments);
      setMovements(nextMovements);
      setParties(nextParties);

      if (!accountId && nextAccounts[0]) {
        setAccountId(nextAccounts[0].id);
      }

      if (requestedDocumentId && !requestedDocumentApplied) {
        const requestedDocument =
          nextDocuments.find((document) => document.id === requestedDocumentId) ?? null;
        if (requestedDocument?.partyId) {
          setPartyId(requestedDocument.partyId);
          setAmount(String(requestedDocument.outstandingAmount));
          setAllocationMode("MANUAL");
          setAllocationInputs({ [requestedDocument.id]: String(requestedDocument.outstandingAmount) });
          setRequestedDocumentApplied(true);
        }
      }

      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to load payments");
    } finally {
      setLoading(false);
    }
  }, [
    accountId,
    activeStore,
    flow,
    isBusinessSelected,
    partyId,
    requestedDocumentApplied,
    requestedDocumentId,
    sourceKind,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setRequestedDocumentApplied(false);
  }, [requestedDocumentId]);

  useEffect(() => {
    setApplyingMovementId(requestedMovementId);
  }, [requestedMovementId]);

  const selectedMovement = useMemo(
    () => movements.find((movement) => movement.id === applyingMovementId) ?? null,
    [applyingMovementId, movements],
  );

  const paymentAmount = Number(amount);
  const availableAmount = selectedMovement
    ? selectedMovement.unallocatedAmount
    : Number.isFinite(paymentAmount) && paymentAmount > 0
      ? paymentAmount
      : 0;

  const autoAllocationInputs = useMemo(() => {
    const nextValues: Record<string, string> = {};
    let remaining = availableAmount;

    for (const document of documents) {
      if (!document.partyId || remaining <= 0) break;
      const nextAmount = Math.min(document.outstandingAmount, remaining);
      if (nextAmount <= 0) continue;
      nextValues[document.id] = String(nextAmount);
      remaining -= nextAmount;
    }

    return nextValues;
  }, [availableAmount, documents]);

  const effectiveAllocationInputs = useMemo(() => {
    if (allocationMode === "AUTO") {
      return autoAllocationInputs;
    }

    if (allocationMode === "ADVANCE") {
      return {};
    }

    return allocationInputs;
  }, [allocationInputs, allocationMode, autoAllocationInputs]);

  const selectedAllocations = useMemo(
    () =>
      documents
        .map((document) => {
          const requestedAmount = Number(effectiveAllocationInputs[document.id] ?? "");
          if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
            return null;
          }
          return {
            documentType: document.documentType,
            documentId: document.id,
            allocatedAmount: requestedAmount,
          };
        })
        .filter((allocation): allocation is {
          documentType: FinancialDocumentBalanceRow["documentType"];
          documentId: string;
          allocatedAmount: number;
        } => allocation !== null),
    [documents, effectiveAllocationInputs],
  );

  const allocatedAmount = selectedAllocations.reduce(
    (sum, allocation) => sum + allocation.allocatedAmount,
    0,
  );
  const remainingAmount = Math.max(availableAmount - allocatedAmount, 0);
  const hasOverAllocated = allocatedAmount - availableAmount > 0.001;

  const partyName =
    parties.find((party) => party.id === partyId)?.name ??
    selectedMovement?.partyName ??
    counterpartyLabel;
  const hasPartySelected = Boolean(partyId);
  const isWorkspaceOpen = Boolean(requestedDocumentId || requestedMovementId || requestedMode === "new");

  const recordedAmount = movements
    .filter((movement) => movement.status !== "VOIDED")
    .reduce((sum, movement) => sum + movement.amount, 0);
  const allocatedAmountTotal = movements
    .filter((movement) => movement.status !== "VOIDED")
    .reduce((sum, movement) => sum + movement.allocatedAmount, 0);
  const remainingBalanceTotal = movements
    .filter((movement) => movement.status !== "VOIDED")
    .reduce((sum, movement) => sum + movement.unallocatedAmount, 0);
  const unappliedMovementCount = movements.filter(
    (movement) => movement.status !== "VOIDED" && movement.unallocatedAmount > 0,
  ).length;
  const totalOutstandingAmount = documents.reduce(
    (sum, document) => sum + document.outstandingAmount,
    0,
  );

  const resetComposer = useCallback(() => {
    setPartyId("");
    setAmount("");
    setOccurredOn(todayValue());
    setReferenceNo("");
    setNotes("");
    setAllocationMode("MANUAL");
    setAllocationInputs({});
    setApplyingMovementId("");
  }, []);

  const openNewWorkspace = (nextPartyId?: string) => {
    if (nextPartyId) {
      setPartyId(nextPartyId);
      setAllocationInputs({});
      setApplyingMovementId("");
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("mode", "new");
      next.delete("movementId");
      return next;
    });
  };

  const openExistingWorkspace = (movement: MoneyMovementRow) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("movementId", movement.id);
      next.delete("mode");
      return next;
    });
  };

  const closeWorkspace = () => {
    resetComposer();
    setSearchParams({});
  };

  const handlePartyChange = (nextPartyId: string) => {
    setPartyId(nextPartyId);
    setAllocationInputs({});
    setApplyingMovementId("");
    setError(null);
  };

  const handleAllocationInputChange = (documentId: string, nextValue: string) => {
    const targetDocument = documents.find((document) => document.id === documentId) ?? null;
    setAllocationMode("MANUAL");
    setAllocationInputs((current) => ({
      ...current,
      [documentId]: clampAllocationInput(nextValue, targetDocument?.outstandingAmount),
    }));
  };

  const handleApplyExistingMovement = (movement: MoneyMovementRow) => {
    setPartyId(movement.partyId ?? "");
    setAllocationMode("MANUAL");
    setAllocationInputs({});
    openExistingWorkspace(movement);
    setError(null);
  };

  const onSubmit = async () => {
    if (!activeStore) {
      setError("Select a business first.");
      return;
    }

    if (!partyId) {
      setError(`${counterpartyLabel} is required for ${paymentLabel.toLowerCase()} workflows.`);
      return;
    }

    if (hasOverAllocated) {
      setError("Allocated amount cannot exceed the available payment amount.");
      return;
    }

    if (selectedMovement) {
      if (selectedAllocations.length === 0) {
        setError("Enter at least one allocation before applying the existing payment.");
        return;
      }

      setLoading(true);
      try {
        await allocatePayment({
          movementId: selectedMovement.id,
          allocations: selectedAllocations,
        });
        resetComposer();
        await load();
      } catch (nextError) {
        console.error(nextError);
        setError(nextError instanceof Error ? nextError.message : "Unable to apply payment");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!accountId) {
      setError("Select a money account first.");
      return;
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        tenantId: activeStore,
        occurredAt: new Date(`${occurredOn}T00:00:00.000Z`).toISOString(),
        amount: paymentAmount,
        financialAccountId: accountId,
        partyId,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: selectedAllocations,
      };

      if (flow === "RECEIVABLE") {
        await recordReceivedPayment(payload);
      } else {
        await recordMadePayment(payload);
      }

      resetComposer();
      if (accounts[0]) {
        setAccountId(accounts[0].id);
      }
      await load();
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : `Unable to save ${paymentLabel.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const onVoidMovement = async (movementId: string) => {
    if (!activeStore) return;

    setLoading(true);
    try {
      await voidMoneyMovement(activeStore, movementId);
      if (applyingMovementId === movementId) {
        setApplyingMovementId("");
      }
      await load();
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : `Unable to void ${paymentLabel.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      {!isWorkspaceOpen ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <Card className="p-2">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>
                    {flow === "RECEIVABLE" ? "Payments Received" : "Payments Made"}
                  </CardTitle>
                  <CardDescription>
                    Browse posted {paymentLabel.toLowerCase()} activity, see allocated versus
                    remaining balances, then drill into a focused workspace when you need to record
                    or apply one payment.
                  </CardDescription>
                </div>
                <Button type="button" onClick={() => openNewWorkspace()} disabled={loading}>
                  {flow === "RECEIVABLE" ? "Record Receipt" : "Record Payment"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground">Recorded Total</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatCurrency(recordedAmount)}
                </p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground">Applied Total</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatCurrency(allocatedAmountTotal)}
                </p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground">Remaining Balance</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatCurrency(remainingBalanceTotal)}
                </p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground">Unapplied {paymentLabel}s</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {unappliedMovementCount}
                </p>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground">Open Invoice Balance</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatCurrency(totalOutstandingAmount)}
                </p>
              </div>
            </CardContent>
          </Card>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <Card className="min-h-0 p-2 lg:flex lg:flex-1 lg:flex-col">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-1 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-sm">
                    {flow === "RECEIVABLE" ? "Receipts List" : "Payments List"}
                  </CardTitle>
                  <CardDescription>
                    Use `Record {paymentLabel}` to create a new one, or `Apply Remaining` on a row
                    when you need to allocate an earlier unapplied balance.
                  </CardDescription>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground">
                  {movements.length} row{movements.length === 1 ? "" : "s"} loaded
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex-1">
              <div className="space-y-2 lg:hidden">
                {movements.length === 0 ? (
                  <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                    No {paymentLabel.toLowerCase()} entries found yet.
                  </div>
                ) : (
                  movements.map((movement) => (
                    <div key={movement.id} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {movement.partyName || "No party"}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {movement.referenceNo || movement.sourceDocumentNumber || "Standalone"}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-semibold ${
                            movement.status === "VOIDED"
                              ? "text-muted-foreground line-through"
                              : flow === "RECEIVABLE"
                                ? "text-foreground"
                                : "text-destructive"
                          }`}
                        >
                          {formatCurrency(movement.amount)}
                        </p>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                        <p>Date: {formatDate(movement.occurredAt)}</p>
                        <p className="truncate">Account: {movement.accountName}</p>
                        <p>Applied: {formatCurrency(movement.allocatedAmount)}</p>
                        <p>Remaining: {formatCurrency(movement.unallocatedAmount)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {movement.status !== "VOIDED" &&
                        movement.unallocatedAmount > 0 &&
                        movement.partyId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleApplyExistingMovement(movement)}
                            disabled={loading}
                          >
                            Apply Remaining
                          </Button>
                        ) : null}
                        {movement.status !== "VOIDED" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => void onVoidMovement(movement.id)}
                            disabled={loading}
                          >
                            Void
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden min-h-0 lg:block">
                <TabularSurface className="min-h-0 overflow-hidden">
                  <TabularHeader>
                    <TabularRow columns={PAYMENT_ROWS_TEMPLATE}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Date</TabularCell>
                      <TabularCell variant="header">Party</TabularCell>
                      <TabularCell variant="header">Reference</TabularCell>
                      <TabularCell variant="header">Account</TabularCell>
                      <TabularCell variant="header" align="end">Amount</TabularCell>
                      <TabularCell variant="header" align="end">Applied</TabularCell>
                      <TabularCell variant="header" align="end">Remaining</TabularCell>
                      <TabularCell variant="header" align="center">Actions</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {movements.length === 0 ? (
                      <TabularRow columns={PAYMENT_ROWS_TEMPLATE}>
                        <TabularSerialNumberCell index={0} />
                        <TabularCell className="col-span-8 text-muted-foreground">
                          No {paymentLabel.toLowerCase()} entries found yet.
                        </TabularCell>
                      </TabularRow>
                    ) : (
                      movements.map((movement, index) => (
                        <TabularRow key={movement.id} columns={PAYMENT_ROWS_TEMPLATE}>
                          <TabularSerialNumberCell index={index} />
                          <TabularCell>{formatDate(movement.occurredAt)}</TabularCell>
                          <TabularCell truncate hoverTitle={movement.partyName || "No party"}>
                            {movement.partyName || "No party"}
                          </TabularCell>
                          <TabularCell
                            truncate
                            hoverTitle={movement.referenceNo || movement.sourceDocumentNumber || "Standalone"}
                          >
                            {movement.referenceNo || movement.sourceDocumentNumber || "Standalone"}
                          </TabularCell>
                          <TabularCell truncate hoverTitle={movement.accountName}>
                            {movement.accountName}
                          </TabularCell>
                          <TabularCell
                            align="end"
                            className={
                              movement.status === "VOIDED"
                                ? "text-muted-foreground line-through"
                                : flow === "RECEIVABLE"
                                  ? "text-foreground"
                                  : "text-destructive"
                            }
                          >
                            {formatCurrency(movement.amount)}
                          </TabularCell>
                          <TabularCell align="end">
                            {formatCurrency(movement.allocatedAmount)}
                          </TabularCell>
                          <TabularCell align="end">
                            {formatCurrency(movement.unallocatedAmount)}
                          </TabularCell>
                          <TabularCell align="center">
                            <div className="flex items-center justify-center gap-1">
                              {movement.status !== "VOIDED" &&
                              movement.unallocatedAmount > 0 &&
                              movement.partyId ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  title="Apply remaining balance"
                                  aria-label="Apply remaining balance"
                                  onClick={() => handleApplyExistingMovement(movement)}
                                  disabled={loading}
                                >
                                  <ArrowRightLeft />
                                </Button>
                              ) : null}
                              {movement.status === "VOIDED" ? (
                                <span className="text-[11px] text-muted-foreground">Voided</span>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title={`Void ${paymentLabel.toLowerCase()}`}
                                  aria-label={`Void ${paymentLabel.toLowerCase()}`}
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => void onVoidMovement(movement.id)}
                                  disabled={loading}
                                >
                                  <Trash2 />
                                </Button>
                              )}
                            </div>
                          </TabularCell>
                        </TabularRow>
                      ))
                    )}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <Card className="p-2">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>
                    {selectedMovement
                      ? `Apply Existing ${paymentLabel}`
                      : flow === "RECEIVABLE"
                        ? "Record Receipt"
                        : "Record Payment"}
                  </CardTitle>
                  <CardDescription>
                    {selectedMovement
                      ? `Apply the remaining balance from an existing ${paymentLabel.toLowerCase()} to open invoices for ${partyName}.`
                      : `Create a new ${paymentLabel.toLowerCase()} and decide what gets applied right now versus what stays unapplied.`}
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={closeWorkspace} disabled={loading}>
                  Back To List
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedMovement ? (
                <div className="grid gap-1 rounded-lg border border-border/80 bg-muted/35 px-2.5 py-2 text-[11px] text-muted-foreground lg:grid-cols-3">
                  <p>
                    <span className="font-semibold text-foreground">1. Pick {counterpartyLabel.toLowerCase()}</span>{" "}
                    and enter the {paymentLabel.toLowerCase()} details.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">2. Review open invoices</span> and enter the amount to apply on each row.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">3. Save</span> the {paymentLabel.toLowerCase()}.
                    Anything left over stays as unapplied credit.
                  </p>
                </div>
              ) : null}

              <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_180px_180px]">
                <div className="space-y-1.5">
                  <Label htmlFor={`payment-party-${flow}`}>Step 1: {counterpartyLabel}</Label>
                  <Select
                    id={`payment-party-${flow}`}
                    value={partyId}
                    onChange={(event) => handlePartyChange(event.target.value)}
                    disabled={loading || Boolean(selectedMovement)}
                  >
                    <option value="">Select {counterpartyLabel.toLowerCase()}</option>
                    {parties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.name}
                        {party.secondaryText ? ` • ${party.secondaryText}` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`payment-account-${flow}`}>{accountLabel}</Label>
                  <Select
                    id={`payment-account-${flow}`}
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    disabled={loading || Boolean(selectedMovement)}
                  >
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`payment-date-${flow}`}>Date</Label>
                  <Input
                    id={`payment-date-${flow}`}
                    type="date"
                    value={occurredOn}
                    onChange={(event) => setOccurredOn(event.target.value)}
                    disabled={loading || Boolean(selectedMovement)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`payment-amount-${flow}`}>
                    {selectedMovement ? "Amount Left On This Payment" : `${paymentLabel} Amount`}
                  </Label>
                  <Input
                    id={`payment-amount-${flow}`}
                    value={selectedMovement ? String(selectedMovement.unallocatedAmount) : amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    disabled={loading || Boolean(selectedMovement)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`payment-mode-${flow}`}>
                    How should this {paymentLabel.toLowerCase()} be used?
                  </Label>
                  <Select
                    id={`payment-mode-${flow}`}
                    value={allocationMode}
                    onChange={(event) => setAllocationMode(event.target.value as AllocationMode)}
                    disabled={loading}
                  >
                    <option value="MANUAL">I will choose invoice amounts</option>
                    <option value="AUTO">Auto apply to oldest invoices</option>
                    <option value="ADVANCE">Keep entire amount as unapplied credit</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`payment-ref-${flow}`}>Reference</Label>
                  <Input
                    id={`payment-ref-${flow}`}
                    value={referenceNo}
                    onChange={(event) => setReferenceNo(event.target.value)}
                    disabled={loading || Boolean(selectedMovement)}
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label htmlFor={`payment-notes-${flow}`}>Notes</Label>
                  <Textarea
                    id={`payment-notes-${flow}`}
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={loading || Boolean(selectedMovement)}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                  <p className="text-[10px] text-muted-foreground">
                    {selectedMovement ? "Selected Payment" : counterpartyLabel}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {selectedMovement?.referenceNo || selectedMovement?.id || partyName || "None selected"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {selectedMovement
                      ? formatDate(selectedMovement.occurredAt)
                      : partyName || `Pick a ${counterpartyLabel.toLowerCase()} first`}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                  <p className="text-[10px] text-muted-foreground">Open Invoices</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{documents.length}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {hasPartySelected
                      ? "Posted invoices for the selected party are ready to allocate."
                      : "Select a party to load allocatable invoices."}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                  <p className="text-[10px] text-muted-foreground">Payment Amount Available</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(availableAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                  <p className="text-[10px] text-muted-foreground">Applied To Invoices</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(allocatedAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                  <p className="text-[10px] text-muted-foreground">Left Unapplied</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(remainingAmount)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {allocationModeLabel}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/70 pt-2 lg:flex-row lg:items-end lg:justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {allocationMode === "ADVANCE"
                    ? `This ${paymentLabel.toLowerCase()} will be saved without applying it to invoices right now.`
                    : hasPartySelected
                      ? `Step 2: review the invoice rows below and enter how much of this ${paymentLabel.toLowerCase()} should go to each one.`
                      : `Select a ${counterpartyLabel.toLowerCase()} to load open invoices for allocation.`}
                </p>
                <Button type="button" onClick={() => void onSubmit()} disabled={loading}>
                  {loading
                    ? "Saving..."
                    : selectedMovement
                      ? `Apply Existing ${paymentLabel}`
                      : flow === "RECEIVABLE"
                        ? "Save Receipt"
                        : "Save Payment"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {hasOverAllocated ? (
            <p className="text-xs text-destructive">
              Allocation exceeds the available payment amount. Reduce one or more rows before saving.
            </p>
          ) : null}

          <Card className="min-h-0 flex-1 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-1 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-sm">Step 2: Apply To Open Invoices</CardTitle>
                  <CardDescription>
                    Use this table only if part or all of the {paymentLabel.toLowerCase()} should be
                    applied to existing invoices for the selected {counterpartyLabel.toLowerCase()}.
                  </CardDescription>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground">
                  {allocationMode === "ADVANCE"
                    ? "Nothing will be applied in this mode."
                    : `${selectedAllocations.length} invoice${selectedAllocations.length === 1 ? "" : "s"} currently selected`}
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex-1">
              <div className="space-y-2 lg:hidden">
                {documents.length === 0 ? (
                  <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                    {hasPartySelected
                      ? "No open invoices found for the selected party."
                      : `Select a ${counterpartyLabel.toLowerCase()} first. Their open invoices will appear here.`}
                  </div>
                ) : (
                  documents.map((document) => (
                    <div key={document.id} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{document.billNumber}</p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {document.partyName || "No party"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(document.outstandingAmount)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <p>Posted: {formatDate(document.postedAt)}</p>
                        <p>Due</p>
                      </div>
                      <div className="mt-2">
                        {allocationMode === "ADVANCE" ? (
                          <p className="text-[11px] text-muted-foreground">Advance</p>
                        ) : allocationMode === "AUTO" ? (
                          <p className="text-sm font-medium text-foreground">
                            {formatCurrency(Number(autoAllocationInputs[document.id] ?? 0))}
                          </p>
                        ) : (
                          <Input
                            value={allocationInputs[document.id] ?? ""}
                            onChange={(event) =>
                              handleAllocationInputChange(document.id, event.target.value)
                            }
                            inputMode="decimal"
                            className="h-8 text-right"
                            disabled={loading}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden min-h-0 lg:block">
                <TabularSurface className="min-h-0 overflow-hidden">
                  <TabularHeader>
                    <TabularRow columns={DOCUMENT_ROWS_TEMPLATE}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Invoice</TabularCell>
                      <TabularCell variant="header">Party</TabularCell>
                      <TabularCell variant="header">Posted</TabularCell>
                      <TabularCell variant="header" align="end">Due</TabularCell>
                      <TabularCell variant="header" align="end">Apply</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {documents.length === 0 ? (
                      <TabularRow columns={DOCUMENT_ROWS_TEMPLATE}>
                        <TabularSerialNumberCell index={0} />
                        <TabularCell className="col-span-5 text-muted-foreground">
                          {hasPartySelected
                            ? "No open invoices found for the selected party."
                            : `Select a ${counterpartyLabel.toLowerCase()} first. Their open invoices will appear here.`}
                        </TabularCell>
                      </TabularRow>
                    ) : (
                      documents.map((document, index) => (
                        <TabularRow key={document.id} columns={DOCUMENT_ROWS_TEMPLATE}>
                          <TabularSerialNumberCell index={index} />
                          <TabularCell truncate hoverTitle={document.billNumber}>
                            {document.billNumber}
                          </TabularCell>
                          <TabularCell truncate hoverTitle={document.partyName || "No party"}>
                            {document.partyName || "No party"}
                          </TabularCell>
                          <TabularCell>{formatDate(document.postedAt)}</TabularCell>
                          <TabularCell align="end">
                            {formatCurrency(document.outstandingAmount)}
                          </TabularCell>
                          <TabularCell align="end">
                            {allocationMode === "ADVANCE" ? (
                              <span className="text-[11px] text-muted-foreground">Advance</span>
                            ) : allocationMode === "AUTO" ? (
                              <span className="font-medium text-foreground">
                                {formatCurrency(Number(autoAllocationInputs[document.id] ?? 0))}
                              </span>
                            ) : (
                              <Input
                                value={allocationInputs[document.id] ?? ""}
                                onChange={(event) =>
                                  handleAllocationInputChange(document.id, event.target.value)
                                }
                                inputMode="decimal"
                                className="h-7 text-right"
                                disabled={loading}
                              />
                            )}
                          </TabularCell>
                        </TabularRow>
                      ))
                    )}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
