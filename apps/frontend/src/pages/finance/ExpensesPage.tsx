import { useCallback, useEffect, useState } from "react";
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
  createExpense,
  listExpenseCategories,
  listExpenses,
  listFinancialAccounts,
  type ExpenseCategoryRow,
  type ExpenseRow,
  type FinancialAccountRow,
} from "./financial-api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

export function ExpensesPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const activeLocationId = useSessionStore((state) => state.activeLocationId);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [accounts, setAccounts] = useState<FinancialAccountRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [payeeName, setPayeeName] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;
    setLoading(true);
    try {
      const [nextAccounts, nextCategories, nextExpenses] = await Promise.all([
        listFinancialAccounts(activeStore),
        listExpenseCategories(activeStore),
        listExpenses(activeStore),
      ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setExpenses(nextExpenses);
      if (!financialAccountId && nextAccounts[0]) setFinancialAccountId(nextAccounts[0].id);
      if (!expenseCategoryId && nextCategories[0]) setExpenseCategoryId(nextCategories[0].id);
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to load expenses");
    } finally {
      setLoading(false);
    }
  }, [activeStore, isBusinessSelected, financialAccountId, expenseCategoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async () => {
    if (!activeStore || !payeeName.trim() || !expenseCategoryId || !financialAccountId) {
      setError("Enter payee, category, and paid via account.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      await createExpense({
        tenantId: activeStore,
        occurredAt: new Date(`${occurredOn}T00:00:00.000Z`).toISOString(),
        amount: parsedAmount,
        expenseCategoryId,
        financialAccountId,
        payeeName: payeeName.trim(),
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        locationId: activeLocationId,
      });
      setPayeeName("");
      setAmount("");
      setReferenceNo("");
      setNotes("");
      await load();
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to save expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <CardTitle>Expenses</CardTitle>
          <CardDescription>Record simple paid expenses with category and money account attribution.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_140px_140px]">
          <div className="space-y-1.5">
            <Label htmlFor="expense-payee">Payee</Label>
            <Input id="expense-payee" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-category">Category</Label>
            <Select id="expense-category" value={expenseCategoryId} onChange={(event) => setExpenseCategoryId(event.target.value)} disabled={loading}>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-account">Paid Via</Label>
            <Select id="expense-account" value={financialAccountId} onChange={(event) => setFinancialAccountId(event.target.value)} disabled={loading}>
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-date">Date</Label>
            <Input id="expense-date" type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Amount</Label>
            <Input id="expense-amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-reference">Reference</Label>
            <Input id="expense-reference" value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="expense-notes">Notes</Label>
            <Input id="expense-notes" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={loading} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void onSubmit()} disabled={loading}>
              {loading ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card className="min-h-0 p-2 lg:flex lg:flex-1 lg:flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 lg:flex-1">
          <TabularSurface className="min-h-0 overflow-hidden">
            <TabularHeader>
              <TabularRow columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr)")}>
                <TabularSerialNumberHeaderCell />
                <TabularCell variant="header">When</TabularCell>
                <TabularCell variant="header">Payee</TabularCell>
                <TabularCell variant="header">Category</TabularCell>
                <TabularCell variant="header" align="end">Amount</TabularCell>
              </TabularRow>
            </TabularHeader>
            <TabularBody className="overflow-y-auto">
              {expenses.map((expense, index) => (
                <TabularRow key={expense.id} columns={withTabularSerialNumberColumn("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr)")}>
                  <TabularSerialNumberCell index={index} />
                  <TabularCell>{new Date(expense.occurredAt).toLocaleDateString()}</TabularCell>
                  <TabularCell>{expense.payeeName}</TabularCell>
                  <TabularCell>{expense.categoryName}</TabularCell>
                  <TabularCell align="end" className="text-destructive">{formatCurrency(expense.amount)}</TabularCell>
                </TabularRow>
              ))}
            </TabularBody>
          </TabularSurface>
        </CardContent>
      </Card>
    </section>
  );
}
