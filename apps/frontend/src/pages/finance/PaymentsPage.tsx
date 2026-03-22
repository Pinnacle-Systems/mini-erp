import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Select } from "../../design-system/atoms/Select";
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
  listFinancialAccounts,
  listMoneyMovements,
  listOpenDocuments,
  recordMadePayment,
  recordReceivedPayment,
  type FinancialAccountRow,
  type FinancialDocumentBalanceRow,
  type MoneyMovementRow,
} from "./financial-api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

const todayValue = () => new Date().toISOString().slice(0, 10);

type PaymentsPageProps = {
  flow: "RECEIVABLE" | "PAYABLE";
};

export function PaymentsPage({ flow }: PaymentsPageProps) {
  const [searchParams] = useSearchParams();
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [accounts, setAccounts] = useState<FinancialAccountRow[]>([]);
  const [documents, setDocuments] = useState<FinancialDocumentBalanceRow[]>([]);
  const [movements, setMovements] = useState<MoneyMovementRow[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayValue);
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedDocumentId = searchParams.get("documentId") ?? "";

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === documentId) ?? null,
    [documentId, documents],
  );

  const load = async () => {
    if (!activeStore || !isBusinessSelected) return;
    setLoading(true);
    try {
      const [nextAccounts, nextDocuments, nextMovements] = await Promise.all([
        listFinancialAccounts(activeStore),
        listOpenDocuments(activeStore, flow),
        listMoneyMovements(activeStore, {
          sourceKind: flow === "RECEIVABLE" ? "PAYMENT_RECEIVED" : "PAYMENT_MADE",
          limit: 50,
        }),
      ]);
      setAccounts(nextAccounts);
      setDocuments(nextDocuments);
      setMovements(nextMovements);
      if (!accountId && nextAccounts[0]) {
        setAccountId(nextAccounts[0].id);
      }
      if (requestedDocumentId) {
        const requestedDocument = nextDocuments.find((document) => document.id === requestedDocumentId);
        if (requestedDocument) {
          setDocumentId(requestedDocument.id);
          setAmount(String(requestedDocument.outstandingAmount));
        }
      }
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [accountId, activeStore, flow, isBusinessSelected, requestedDocumentId]);

  const handleDocumentChange = (nextDocumentId: string) => {
    setDocumentId(nextDocumentId);
    const nextDocument = documents.find((document) => document.id === nextDocumentId);
    if (nextDocument) {
      setAmount(String(nextDocument.outstandingAmount));
    }
  };

  const onSubmit = async () => {
    if (!activeStore || !selectedDocument || !accountId) {
      setError("Select a document and money account first.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        tenantId: activeStore,
        occurredAt: new Date(`${occurredOn}T00:00:00.000Z`).toISOString(),
        amount: parsedAmount,
        financialAccountId: accountId,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: [
          {
            documentType: selectedDocument.documentType,
            documentId: selectedDocument.id,
            allocatedAmount: parsedAmount,
          },
        ],
      };

      if (flow === "RECEIVABLE") {
        await recordReceivedPayment(payload);
      } else {
        await recordMadePayment(payload);
      }

      setDocumentId("");
      setAmount("");
      setReferenceNo("");
      setNotes("");
      await load();
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to save payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <CardTitle>{flow === "RECEIVABLE" ? "Payments Received" : "Payments Made"}</CardTitle>
          <CardDescription>
            Record posted document settlements and review recent payment activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_160px]">
          <div className="space-y-1.5">
            <Label htmlFor={`payment-doc-${flow}`}>Document</Label>
            <Select id={`payment-doc-${flow}`} value={documentId} onChange={(event) => handleDocumentChange(event.target.value)} disabled={loading}>
              <option value="">Select document</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.billNumber} • {document.partyName || "No party"} • {formatCurrency(document.outstandingAmount)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`payment-account-${flow}`}>{flow === "RECEIVABLE" ? "Received In" : "Paid Via"}</Label>
            <Select id={`payment-account-${flow}`} value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={loading}>
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
            <Input id={`payment-date-${flow}`} type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`payment-amount-${flow}`}>Amount</Label>
            <Input id={`payment-amount-${flow}`} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`payment-ref-${flow}`}>Reference</Label>
            <Input id={`payment-ref-${flow}`} value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor={`payment-notes-${flow}`}>Notes</Label>
            <Input id={`payment-notes-${flow}`} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={loading} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void onSubmit()} disabled={loading}>
              {loading ? "Saving..." : flow === "RECEIVABLE" ? "Record Receipt" : "Record Payment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card className="min-h-0 p-2 lg:flex lg:flex-1 lg:flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Entries</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 lg:flex-1">
          <TabularSurface className="min-h-0 overflow-hidden">
            <TabularHeader>
              <TabularRow columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr)")}>
                <TabularSerialNumberHeaderCell />
                <TabularCell variant="header">When</TabularCell>
                <TabularCell variant="header">Document</TabularCell>
                <TabularCell variant="header">Account</TabularCell>
                <TabularCell variant="header" align="end">Amount</TabularCell>
              </TabularRow>
            </TabularHeader>
            <TabularBody className="overflow-y-auto">
              {movements.map((movement, index) => (
                <TabularRow key={movement.id} columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr)")}>
                  <TabularSerialNumberCell index={index} />
                  <TabularCell>{new Date(movement.occurredAt).toLocaleDateString()}</TabularCell>
                  <TabularCell>{movement.sourceDocumentNumber || movement.partyName || "Standalone"}</TabularCell>
                  <TabularCell>{movement.accountName}</TabularCell>
                  <TabularCell align="end" className={flow === "RECEIVABLE" ? "text-foreground" : "text-destructive"}>
                    {formatCurrency(movement.amount)}
                  </TabularCell>
                </TabularRow>
              ))}
            </TabularBody>
          </TabularSurface>
        </CardContent>
      </Card>
    </section>
  );
}
