import { useCallback, useEffect, useMemo, useState } from "react";
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
  "minmax(0,0.9fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,0.75fr) minmax(0,0.75fr) minmax(0,0.75fr) minmax(0,0.9fr)",
);

const DOCUMENT_ROWS_TEMPLATE = withTabularSerialNumberColumn(
  "minmax(0,1fr) minmax(0,0.9fr) minmax(0,0.75fr) minmax(0,0.75fr) minmax(0,0.75fr) minmax(0,0.85fr)",
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
  const [searchParams] = useSearchParams();
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

  const paymentLabel = flow === "RECEIVABLE" ? "Receipt" : "Payment";
  const counterpartyLabel = flow === "RECEIVABLE" ? "Customer" : "Supplier";
  const accountLabel = flow === "RECEIVABLE" ? "Received In" : "Paid Via";
  const sourceKind = flow === "RECEIVABLE" ? "PAYMENT_RECEIVED" : "PAYMENT_MADE";

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

  const effectiveAllocationInputs =
    allocationMode === "AUTO"
      ? autoAllocationInputs
      : allocationMode === "ADVANCE"
        ? {}
        : allocationInputs;

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
    setApplyingMovementId(movement.id);
    setPartyId(movement.partyId ?? "");
    setAllocationMode("MANUAL");
    setAllocationInputs({});
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
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="p-2">
          <CardHeader className="pb-2">
            <CardTitle>
              {selectedMovement
                ? `Apply Existing ${paymentLabel}`
                : flow === "RECEIVABLE"
                  ? "Payments Received"
                  : "Payments Made"}
            </CardTitle>
            <CardDescription>
              Record advances, split one payment across many invoices, or apply existing unapplied
              credit later.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor={`payment-party-${flow}`}>{counterpartyLabel}</Label>
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
                {selectedMovement ? "Available to Apply" : "Amount"}
              </Label>
              <Input
                id={`payment-amount-${flow}`}
                value={
                  selectedMovement
                    ? String(selectedMovement.unallocatedAmount)
                    : amount
                }
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                disabled={loading || Boolean(selectedMovement)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`payment-mode-${flow}`}>Allocation Mode</Label>
              <Select
                id={`payment-mode-${flow}`}
                value={allocationMode}
                onChange={(event) => setAllocationMode(event.target.value as AllocationMode)}
                disabled={loading}
              >
                <option value="MANUAL">Manual allocate</option>
                <option value="AUTO">Auto allocate oldest</option>
                <option value="ADVANCE">Save as advance</option>
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
            <div className="flex items-end justify-end gap-2">
              {selectedMovement ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setApplyingMovementId("")}
                  disabled={loading}
                >
                  Stop Applying
                </Button>
              ) : null}
              <Button type="button" onClick={() => void onSubmit()} disabled={loading}>
                {loading
                  ? "Saving..."
                  : selectedMovement
                    ? "Apply Remaining"
                    : flow === "RECEIVABLE"
                      ? "Record Receipt"
                      : "Record Payment"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Allocation Summary</CardTitle>
            <CardDescription>
              {selectedMovement
                ? `Applying unapplied ${paymentLabel.toLowerCase()} for ${partyName}.`
                : `Create a new ${paymentLabel.toLowerCase()} and decide what stays unapplied.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">
                {selectedMovement ? "Selected Payment" : counterpartyLabel}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {selectedMovement?.referenceNo || selectedMovement?.id || partyName || "None selected"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {selectedMovement ? formatDate(selectedMovement.occurredAt) : partyName || "Pick a party first"}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Open Invoices</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{documents.length}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {partyId ? "Only posted invoices for the selected party are shown." : "Select a party to load allocatable invoices."}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Available Amount</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(availableAmount)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Allocated Now</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(allocatedAmount)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Remaining Credit</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(remainingAmount)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Mode</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {allocationMode === "AUTO"
                  ? "Auto allocate oldest"
                  : allocationMode === "ADVANCE"
                    ? "Save as advance"
                    : "Manual allocate"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {hasOverAllocated ? (
        <p className="text-xs text-destructive">
          Allocation exceeds the available payment amount. Reduce one or more rows before saving.
        </p>
      ) : null}

      <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="min-h-0 p-2 lg:flex lg:flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Allocatable Invoices</CardTitle>
            <CardDescription>
              Apply the {paymentLabel.toLowerCase()} against one or more open invoices for the
              selected {counterpartyLabel.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 lg:flex-1">
            <TabularSurface className="min-h-0 overflow-hidden">
              <TabularHeader>
                <TabularRow columns={DOCUMENT_ROWS_TEMPLATE}>
                  <TabularSerialNumberHeaderCell />
                  <TabularCell variant="header">Invoice</TabularCell>
                  <TabularCell variant="header">Posted</TabularCell>
                  <TabularCell variant="header" align="end">Total</TabularCell>
                  <TabularCell variant="header" align="end">Paid</TabularCell>
                  <TabularCell variant="header" align="end">Outstanding</TabularCell>
                  <TabularCell variant="header" align="end">Allocate</TabularCell>
                </TabularRow>
              </TabularHeader>
              <TabularBody className="overflow-y-auto">
                {documents.length === 0 ? (
                  <TabularRow columns={DOCUMENT_ROWS_TEMPLATE}>
                    <TabularSerialNumberCell index={0} />
                    <TabularCell className="col-span-6 text-muted-foreground">
                      {partyId
                        ? "No open invoices found for the selected party."
                        : `Select a ${counterpartyLabel.toLowerCase()} to load open invoices.`}
                    </TabularCell>
                  </TabularRow>
                ) : (
                  documents.map((document, index) => (
                    <TabularRow key={document.id} columns={DOCUMENT_ROWS_TEMPLATE}>
                      <TabularSerialNumberCell index={index} />
                      <TabularCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{document.billNumber}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {document.partyName || "No party"}
                          </p>
                        </div>
                      </TabularCell>
                      <TabularCell>{formatDate(document.postedAt)}</TabularCell>
                      <TabularCell align="end">{formatCurrency(document.grossDocumentAmount)}</TabularCell>
                      <TabularCell align="end">{formatCurrency(document.paidAmount)}</TabularCell>
                      <TabularCell align="end">{formatCurrency(document.outstandingAmount)}</TabularCell>
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
          </CardContent>
        </Card>

        <Card className="min-h-0 p-2 lg:flex lg:flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Entries</CardTitle>
            <CardDescription>
              Review posted {paymentLabel.toLowerCase()} activity, void incorrect rows, or apply
              remaining unapplied credit.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 lg:flex-1">
            <TabularSurface className="min-h-0 overflow-hidden">
              <TabularHeader>
                <TabularRow columns={PAYMENT_ROWS_TEMPLATE}>
                  <TabularSerialNumberHeaderCell />
                  <TabularCell variant="header">When</TabularCell>
                  <TabularCell variant="header">Reference</TabularCell>
                  <TabularCell variant="header">Account</TabularCell>
                  <TabularCell variant="header" align="end">Amount</TabularCell>
                  <TabularCell variant="header" align="end">Allocated</TabularCell>
                  <TabularCell variant="header" align="end">Remaining</TabularCell>
                  <TabularCell variant="header" align="center">Actions</TabularCell>
                </TabularRow>
              </TabularHeader>
              <TabularBody className="overflow-y-auto">
                {movements.map((movement, index) => (
                  <TabularRow key={movement.id} columns={PAYMENT_ROWS_TEMPLATE}>
                    <TabularSerialNumberCell index={index} />
                    <TabularCell>{formatDate(movement.occurredAt)}</TabularCell>
                    <TabularCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {movement.sourceDocumentNumber ||
                            movement.referenceNo ||
                            movement.partyName ||
                            "Standalone"}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {movement.partyName || "No party"}
                        </p>
                      </div>
                    </TabularCell>
                    <TabularCell>{movement.accountName}</TabularCell>
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
                    <TabularCell align="end">{formatCurrency(movement.allocatedAmount)}</TabularCell>
                    <TabularCell align="end">{formatCurrency(movement.unallocatedAmount)}</TabularCell>
                    <TabularCell align="center">
                      <div className="flex items-center justify-center gap-1">
                        {movement.status !== "VOIDED" && movement.unallocatedAmount > 0 && movement.partyId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleApplyExistingMovement(movement)}
                            disabled={loading}
                          >
                            Apply
                          </Button>
                        ) : null}
                        {movement.status === "VOIDED" ? (
                          <span className="text-[11px] text-muted-foreground">Voided</span>
                        ) : (
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
                        )}
                      </div>
                    </TabularCell>
                  </TabularRow>
                ))}
              </TabularBody>
            </TabularSurface>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
