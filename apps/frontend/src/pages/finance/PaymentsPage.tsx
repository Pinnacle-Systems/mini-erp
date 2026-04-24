import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ListChecks, RotateCcw, Trash2 } from "lucide-react";
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
import { useToast } from "../../features/toast/useToast";
import {
  allocatePayment,
  listFinancialAccounts,
  listMoneyMovements,
  listOpenDocuments,
  listPaymentAllocations,
  recordMadePayment,
  recordReceivedPayment,
  reversePaymentAllocation,
  voidMoneyMovement,
  type FinancialAccountRow,
  type FinancialDocumentBalanceRow,
  type MoneyMovementRow,
  type PaymentAllocationRow,
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

const getDisplayRemainingAmount = (movement: MoneyMovementRow) =>
  movement.status === "VOIDED" ? 0 : movement.unallocatedAmount;

const todayValue = () => new Date().toISOString().slice(0, 10);

const PAYMENT_ROWS_TEMPLATE = withTabularSerialNumberColumn(
  "96px minmax(0,1.1fr) minmax(0,1fr) minmax(0,0.9fr) 88px 88px 96px 72px",
);

const DOCUMENT_ROWS_TEMPLATE = withTabularSerialNumberColumn(
  "minmax(0,1fr) minmax(0,1fr) 96px 104px 120px",
);

const ALLOCATION_ROWS_TEMPLATE = withTabularSerialNumberColumn(
  "minmax(0,1fr) 104px 112px 112px 76px",
);

type PaymentsPageProps = {
  flow: "RECEIVABLE" | "PAYABLE";
};

type AllocationMode = "MANUAL" | "AUTO" | "ADVANCE";
type WorkspaceStep = "DETAILS" | "REVIEW";

type PartyOption = {
  id: string;
  name: string;
  secondaryText: string;
};

const clampAllocationInput = (value: string, maxAmount?: number) => {
  const trimmedValue = value.trim();
  if (trimmedValue === "") return "";

  if (!/^\d*\.?\d*$/.test(trimmedValue)) {
    return "";
  }

  if (trimmedValue === ".") {
    return "0.";
  }

  const parsed = Number(trimmedValue);
  if (!Number.isFinite(parsed) || parsed < 0) return "";

  const hasTrailingDecimalPoint = trimmedValue.endsWith(".");
  if (Number.isFinite(maxAmount) && typeof maxAmount === "number" && maxAmount > 0 && parsed > maxAmount) {
    return String(maxAmount);
  }

  if (hasTrailingDecimalPoint) {
    return trimmedValue;
  }

  return trimmedValue;
};

export function PaymentsPage({ flow }: PaymentsPageProps) {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [accounts, setAccounts] = useState<FinancialAccountRow[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [documents, setDocuments] = useState<FinancialDocumentBalanceRow[]>([]);
  const [movements, setMovements] = useState<MoneyMovementRow[]>([]);
  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocationRow[]>([]);
  const [partyId, setPartyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayValue);
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("MANUAL");
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});
  const [applyingMovementId, setApplyingMovementId] = useState("");
  const [reversingAllocationId, setReversingAllocationId] = useState("");
  const [workspaceStep, setWorkspaceStep] = useState<WorkspaceStep>("DETAILS");
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

  useEffect(() => {
    if (!selectedMovement) return;
    setWorkspaceStep("REVIEW");
  }, [selectedMovement]);

  const loadSelectedPaymentAllocations = useCallback(async () => {
    if (!selectedMovement) {
      setPaymentAllocations([]);
      return;
    }

    try {
      setPaymentAllocations(await listPaymentAllocations(selectedMovement.id));
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to load payment allocations");
    }
  }, [selectedMovement]);

  useEffect(() => {
    void loadSelectedPaymentAllocations();
  }, [loadSelectedPaymentAllocations]);

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
  const reviewDocuments = useMemo(() => {
    if (allocationMode !== "AUTO") {
      return documents;
    }

    return documents.filter((document) => Number(autoAllocationInputs[document.id] ?? 0) > 0);
  }, [allocationMode, autoAllocationInputs, documents]);

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
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ??
    selectedMovement?.accountName ??
    "No account";
  const reviewOccurredAt = selectedMovement
    ? selectedMovement.occurredAt
    : occurredOn
      ? new Date(`${occurredOn}T00:00:00.000Z`).toISOString()
      : null;
  const hasPartySelected = Boolean(partyId);
  const isWorkspaceOpen = Boolean(requestedDocumentId || requestedMovementId || requestedMode === "new");
  const isExistingPaymentFlow = Boolean(selectedMovement);
  const isReviewStep = workspaceStep === "REVIEW";
  const showInvoiceReview = allocationMode !== "ADVANCE";
  const canGoBackToDetails = !isExistingPaymentFlow && isReviewStep;

  const reviewTitle = isExistingPaymentFlow
    ? `Apply Existing ${paymentLabel}`
    : allocationMode === "ADVANCE"
      ? "Review Unapplied Credit"
      : allocationMode === "AUTO"
        ? "Review Auto Application"
        : "Review Invoice Allocation";

  const reviewDescription = isExistingPaymentFlow
    ? `Apply the remaining balance from this ${paymentLabel.toLowerCase()} to the open invoices shown below.`
    : allocationMode === "ADVANCE"
      ? `Confirm that this ${paymentLabel.toLowerCase()} will stay fully unapplied. No invoice will be touched.`
      : allocationMode === "AUTO"
        ? `Review the oldest invoices that will be applied automatically when you save this ${paymentLabel.toLowerCase()}.`
        : `Review or edit the invoice allocations before saving this ${paymentLabel.toLowerCase()}.`;

  const reviewCountLabel = showInvoiceReview
    ? `${selectedAllocations.length} invoice${selectedAllocations.length === 1 ? "" : "s"} ${
        allocationMode === "AUTO" ? "will be applied" : "selected"
      }`
    : "No invoices will be applied";

  const submitButtonLabel = loading
    ? "Saving..."
    : isExistingPaymentFlow
      ? `Apply Existing ${paymentLabel}`
      : allocationMode === "ADVANCE"
        ? `Save ${paymentLabel} as Unapplied Credit`
        : allocationMode === "AUTO"
          ? `Confirm and Save ${paymentLabel}`
          : `Save ${paymentLabel}`;

  const stepIndicatorLabel = isExistingPaymentFlow
    ? "Review and Apply"
    : isReviewStep
      ? "Step 2 of 2: Review"
      : "Step 1 of 2: Payment Details";

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
    setPaymentAllocations([]);
    setWorkspaceStep("DETAILS");
  }, []);

  const openNewWorkspace = (nextPartyId?: string) => {
    if (nextPartyId) {
      setPartyId(nextPartyId);
      setAllocationInputs({});
      setApplyingMovementId("");
    }
    setWorkspaceStep("DETAILS");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("mode", "new");
      next.delete("movementId");
      return next;
    });
  };

  const openExistingWorkspace = (movement: MoneyMovementRow) => {
    setWorkspaceStep("REVIEW");
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
    setWorkspaceStep("DETAILS");
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
    setAccountId(movement.accountId);
    setAmount(String(movement.unallocatedAmount));
    setOccurredOn(movement.occurredAt.slice(0, 10));
    setReferenceNo(movement.referenceNo || "");
    setNotes(movement.notes || "");
    setAllocationMode("MANUAL");
    setAllocationInputs({});
    openExistingWorkspace(movement);
    setError(null);
  };

  const handleReverseAllocation = async (allocation: PaymentAllocationRow) => {
    if (!selectedMovement) return;
    const reason = window.prompt(
      `Reverse allocation of ${formatCurrency(allocation.allocatedAmount)} from ${
        allocation.documentNumber || "this invoice"
      }?\n\nOptional reason:`,
      "",
    );
    if (reason === null) {
      return;
    }

    setReversingAllocationId(allocation.id);
    setLoading(true);
    try {
      const result = await reversePaymentAllocation({
        movementId: selectedMovement.id,
        allocationId: allocation.id,
        reason: reason.trim() || undefined,
      });
      setPaymentAllocations(result.allocations);
      await load();
      showToast({
        title: "Allocation reversed",
        description: `${formatCurrency(
          result.reversedAllocation.allocatedAmount,
        )} has been returned to the unapplied balance of this ${paymentLabel.toLowerCase()}.`,
        tone: "success",
        dedupeKey: `payment-allocation-reversed:${allocation.id}`,
      });
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to reverse allocation");
    } finally {
      setReversingAllocationId("");
      setLoading(false);
    }
  };

  const validateDetailsStep = () => {
    if (!activeStore) {
      setError("Select a business first.");
      return false;
    }

    if (!partyId) {
      setError(`${counterpartyLabel} is required for ${paymentLabel.toLowerCase()} workflows.`);
      return false;
    }

    if (!accountId) {
      setError("Select a money account first.");
      return false;
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError("Amount must be a positive number.");
      return false;
    }

    setError(null);
    return true;
  };

  const openReviewStep = () => {
    if (!validateDetailsStep()) {
      return;
    }
    setWorkspaceStep("REVIEW");
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
        setSearchParams({});
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
      setSearchParams({});
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
    const movement = movements.find((entry) => entry.id === movementId) ?? null;
    const confirmed = window.confirm(
      `Void this ${paymentLabel.toLowerCase()}${
        movement?.partyName ? ` for ${movement.partyName}` : ""
      }?\n\nThis will mark it as void and remove it from active balances.`,
    );
    if (!confirmed) {
      return;
    }

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
                        <p>Remaining: {formatCurrency(getDisplayRemainingAmount(movement))}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {movement.status !== "VOIDED" && movement.allocatedAmount > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleApplyExistingMovement(movement)}
                            disabled={loading}
                          >
                            View Allocations
                          </Button>
                        ) : null}
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
                            variant="outline"
                            size="sm"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => void onVoidMovement(movement.id)}
                            disabled={loading}
                          >
                            Void {paymentLabel}
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
                            {formatCurrency(getDisplayRemainingAmount(movement))}
                          </TabularCell>
                          <TabularCell align="center">
                            <div className="flex items-center justify-center gap-1">
                              {movement.status !== "VOIDED" &&
                              movement.allocatedAmount > 0 ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  title="View allocations"
                                  aria-label="View allocations"
                                  onClick={() => handleApplyExistingMovement(movement)}
                                  disabled={loading}
                                >
                                  <ListChecks />
                                </Button>
                              ) : null}
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
                                  variant="outline"
                                  size="icon"
                                  title={`Void ${paymentLabel.toLowerCase()}`}
                                  aria-label={`Void ${paymentLabel.toLowerCase()}`}
                                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
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
                    {isExistingPaymentFlow
                      ? `Apply Existing ${paymentLabel}`
                      : flow === "RECEIVABLE"
                        ? "Record Receipt"
                        : "Record Payment"}
                  </CardTitle>
                  <CardDescription>
                    {isExistingPaymentFlow
                      ? `Review how the remaining ${paymentLabel.toLowerCase()} balance should be applied for ${partyName}.`
                      : isReviewStep
                        ? reviewDescription
                        : `Enter the ${paymentLabel.toLowerCase()} details first, then review the outcome before saving.`}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canGoBackToDetails ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setWorkspaceStep("DETAILS")}
                      disabled={loading}
                    >
                      Back To Details
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={closeWorkspace} disabled={loading}>
                    Back To List
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/30 px-2.5 py-2 text-[11px]">
                <div>
                  <p className="font-semibold text-foreground">{stepIndicatorLabel}</p>
                  <p className="text-muted-foreground">
                    {isExistingPaymentFlow
                      ? "Payment details are fixed. Choose how the remaining balance should be allocated."
                      : isReviewStep
                        ? reviewDescription
                        : `Choose whether this ${paymentLabel.toLowerCase()} should stay unapplied, auto apply, or be allocated manually.`}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground">
                  {allocationModeLabel}
                </div>
              </div>

              {!isExistingPaymentFlow && !isReviewStep ? (
                <div className="grid gap-1 rounded-lg border border-border/80 bg-muted/35 px-2.5 py-2 text-[11px] text-muted-foreground lg:grid-cols-3">
                  <p>
                    <span className="font-semibold text-foreground">1. Enter details</span> for the{" "}
                    {paymentLabel.toLowerCase()} and choose how it should be used.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">2. Review outcome</span> before
                    saving, with invoice rows shown only when they are relevant.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">3. Confirm save</span> once the
                    applied and unapplied amounts look right.
                  </p>
                </div>
              ) : null}

              {!isReviewStep ? (
                <>
                  <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_180px_180px]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`payment-party-${flow}`}>{counterpartyLabel}</Label>
                      <Select
                        id={`payment-party-${flow}`}
                        value={partyId}
                        onChange={(event) => handlePartyChange(event.target.value)}
                        disabled={loading}
                      >
                        <option value="">Select {counterpartyLabel.toLowerCase()}</option>
                        {parties.map((party) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                            {party.secondaryText ? ` - ${party.secondaryText}` : ""}
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
                        disabled={loading}
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
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`payment-amount-${flow}`}>{paymentLabel} Amount</Label>
                      <Input
                        id={`payment-amount-${flow}`}
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        inputMode="decimal"
                        disabled={loading}
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
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <Label htmlFor={`payment-notes-${flow}`}>Notes</Label>
                      <Textarea
                        id={`payment-notes-${flow}`}
                        rows={2}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">{counterpartyLabel}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {partyName}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {hasPartySelected
                          ? "Open invoices will load for this party in review."
                          : `Choose a ${counterpartyLabel.toLowerCase()} to continue.`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">Open Invoices</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{documents.length}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {showInvoiceReview
                          ? "Review step will show matching invoices."
                          : "Review step will skip invoice allocation."}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">Payment Amount</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatCurrency(availableAmount)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">Planned Apply</p>
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
                        ? `Continue to review this ${paymentLabel.toLowerCase()} as unapplied credit.`
                        : allocationMode === "AUTO"
                          ? `Continue to review the oldest invoices that will be applied automatically.`
                          : `Continue to the invoice allocation step and choose how much should be applied on each row.`}
                    </p>
                    <Button type="button" onClick={openReviewStep} disabled={loading}>
                      Continue To Review
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">
                        {isExistingPaymentFlow ? "Selected Payment" : counterpartyLabel}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {selectedMovement?.referenceNo || selectedMovement?.id || partyName}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{partyName}</p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">{accountLabel}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">{accountName}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDate(reviewOccurredAt)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">Amount Available</p>
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

                  <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`payment-mode-review-${flow}`}>
                        How should this {paymentLabel.toLowerCase()} be used?
                      </Label>
                      <Select
                        id={`payment-mode-review-${flow}`}
                        value={allocationMode}
                        onChange={(event) => setAllocationMode(event.target.value as AllocationMode)}
                        disabled={loading}
                      >
                        <option value="MANUAL">I will choose invoice amounts</option>
                        <option value="AUTO">Auto apply to oldest invoices</option>
                        {!isExistingPaymentFlow ? (
                          <option value="ADVANCE">Keep entire amount as unapplied credit</option>
                        ) : null}
                      </Select>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-muted/35 px-2.5 py-2 text-[11px] text-muted-foreground">
                      <p className="font-semibold text-foreground">{reviewTitle}</p>
                      <p className="mt-1">{reviewDescription}</p>
                      {referenceNo || notes ? (
                        <p className="mt-1">
                          {referenceNo ? `Reference: ${referenceNo}. ` : ""}
                          {notes ? `Notes: ${notes}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground">
                      {reviewCountLabel}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {hasOverAllocated && isReviewStep ? (
            <p className="text-xs text-destructive">
              Allocation exceeds the available payment amount. Reduce one or more rows before saving.
            </p>
          ) : null}

          {isReviewStep ? (
            <>
              {selectedMovement || paymentAllocations.length > 0 ? (
                <Card className="p-2">
                  <CardHeader className="pb-2">
                    <div className="flex flex-col gap-1 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle className="text-sm">Allocation History</CardTitle>
                        <CardDescription>
                          Review where this {paymentLabel.toLowerCase()} has been applied. Reverse
                          only the allocation row that needs correction.
                        </CardDescription>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground">
                        {paymentAllocations.filter((allocation) => allocation.status === "ACTIVE").length} active
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 lg:hidden">
                      {paymentAllocations.length === 0 ? (
                        <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                          No allocations recorded for this {paymentLabel.toLowerCase()} yet.
                        </div>
                      ) : (
                        paymentAllocations.map((allocation) => (
                          <div key={allocation.id} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {allocation.documentNumber || "Invoice"}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {allocation.status === "ACTIVE" ? "Active" : "Reversed"}
                                </p>
                              </div>
                              <p
                                className={`text-sm font-semibold ${
                                  allocation.status === "REVERSED"
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                                }`}
                              >
                                {formatCurrency(allocation.allocatedAmount)}
                              </p>
                            </div>
                            {allocation.reversalReason ? (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                {allocation.reversalReason}
                              </p>
                            ) : null}
                            <div className="mt-2 flex justify-end">
                              {allocation.status === "ACTIVE" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                  onClick={() => void handleReverseAllocation(allocation)}
                                  disabled={loading || reversingAllocationId === allocation.id}
                                >
                                  Reverse Allocation
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="hidden lg:block">
                      <TabularSurface className="overflow-hidden">
                        <TabularHeader>
                          <TabularRow columns={ALLOCATION_ROWS_TEMPLATE}>
                            <TabularSerialNumberHeaderCell />
                            <TabularCell variant="header">Invoice</TabularCell>
                            <TabularCell variant="header" align="end">Amount</TabularCell>
                            <TabularCell variant="header">Status</TabularCell>
                            <TabularCell variant="header">Reason</TabularCell>
                            <TabularCell variant="header" align="center">Actions</TabularCell>
                          </TabularRow>
                        </TabularHeader>
                        <TabularBody>
                          {paymentAllocations.length === 0 ? (
                            <TabularRow columns={ALLOCATION_ROWS_TEMPLATE}>
                              <TabularSerialNumberCell index={0} />
                              <TabularCell className="col-span-5 text-muted-foreground">
                                No allocations recorded for this {paymentLabel.toLowerCase()} yet.
                              </TabularCell>
                            </TabularRow>
                          ) : (
                            paymentAllocations.map((allocation, index) => (
                              <TabularRow key={allocation.id} columns={ALLOCATION_ROWS_TEMPLATE}>
                                <TabularSerialNumberCell index={index} />
                                <TabularCell truncate hoverTitle={allocation.documentNumber || "Invoice"}>
                                  {allocation.documentNumber || "Invoice"}
                                </TabularCell>
                                <TabularCell
                                  align="end"
                                  className={
                                    allocation.status === "REVERSED"
                                      ? "text-muted-foreground line-through"
                                      : "text-foreground"
                                  }
                                >
                                  {formatCurrency(allocation.allocatedAmount)}
                                </TabularCell>
                                <TabularCell>{allocation.status === "ACTIVE" ? "Active" : "Reversed"}</TabularCell>
                                <TabularCell truncate hoverTitle={allocation.reversalReason || ""}>
                                  {allocation.reversalReason || "-"}
                                </TabularCell>
                                <TabularCell align="center">
                                  {allocation.status === "ACTIVE" ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      title="Reverse allocation"
                                      aria-label="Reverse allocation"
                                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                      onClick={() => void handleReverseAllocation(allocation)}
                                      disabled={loading || reversingAllocationId === allocation.id}
                                    >
                                      <RotateCcw />
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">Reversed</span>
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
              ) : null}

              {showInvoiceReview ? (
                <Card className="min-h-0 flex-1 p-2 lg:flex lg:flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex flex-col gap-1 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle className="text-sm">{reviewTitle}</CardTitle>
                        <CardDescription>{reviewDescription}</CardDescription>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground">
                        {reviewCountLabel}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 lg:flex-1">
                    <div className="space-y-2 lg:hidden">
                      {reviewDocuments.length === 0 ? (
                        <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                          {hasPartySelected
                            ? allocationMode === "AUTO"
                              ? `No invoices will be auto-applied, so this ${paymentLabel.toLowerCase()} will remain unapplied.`
                              : "No open invoices found for the selected party."
                            : `Select a ${counterpartyLabel.toLowerCase()} first. Their open invoices will appear here.`}
                        </div>
                      ) : (
                        reviewDocuments.map((document) => (
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
                              <p>{allocationMode === "AUTO" ? "Auto apply" : "Apply amount"}</p>
                            </div>
                            <div className="mt-2">
                              {allocationMode === "AUTO" ? (
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
                            <TabularCell variant="header" align="end">
                              {allocationMode === "AUTO" ? "Auto Apply" : "Apply"}
                            </TabularCell>
                          </TabularRow>
                        </TabularHeader>
                        <TabularBody className="overflow-y-auto">
                          {reviewDocuments.length === 0 ? (
                            <TabularRow columns={DOCUMENT_ROWS_TEMPLATE}>
                              <TabularSerialNumberCell index={0} />
                              <TabularCell className="col-span-5 text-muted-foreground">
                                {hasPartySelected
                                  ? allocationMode === "AUTO"
                                    ? `No invoices will be auto-applied, so this ${paymentLabel.toLowerCase()} will remain unapplied.`
                                    : "No open invoices found for the selected party."
                                  : `Select a ${counterpartyLabel.toLowerCase()} first. Their open invoices will appear here.`}
                              </TabularCell>
                            </TabularRow>
                          ) : (
                            reviewDocuments.map((document, index) => (
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
                                  {allocationMode === "AUTO" ? (
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
              ) : (
                <Card className="p-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{reviewTitle}</CardTitle>
                    <CardDescription>{reviewDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-border/80 bg-muted/35 px-3 py-3 text-sm text-muted-foreground">
                      This {paymentLabel.toLowerCase()} will be saved in full as unapplied credit.
                      No invoice allocation will happen in this step.
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col gap-2 border-t border-border/70 pt-2 lg:flex-row lg:items-end lg:justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {allocationMode === "ADVANCE"
                    ? `Saving now will keep the full ${paymentLabel.toLowerCase()} available as unapplied credit.`
                    : allocationMode === "AUTO"
                      ? `Saving now will apply the oldest invoices exactly as shown above, and anything left over will stay unapplied.`
                      : `Saving now will use the allocation amounts shown above. Any remaining balance will stay unapplied.`}
                </p>
                <Button type="button" onClick={() => void onSubmit()} disabled={loading}>
                  {submitButtonLabel}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
