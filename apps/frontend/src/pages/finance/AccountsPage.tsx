import { useEffect, useState } from "react";
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
import { useSessionStore } from "../../features/auth/session-business";
import {
  archiveFinancialAccount,
  createFinancialAccount,
  listFinancialAccounts,
  type FinancialAccountRow,
} from "./financial-api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);

export function AccountsPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [accounts, setAccounts] = useState<FinancialAccountRow[]>([]);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<FinancialAccountRow["accountType"]>("BANK");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!activeStore || !isBusinessSelected) return;
    setLoading(true);
    try {
      setAccounts(await listFinancialAccounts(activeStore, true));
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to load financial accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [activeStore, isBusinessSelected]);

  const onCreate = async () => {
    if (!activeStore || !name.trim()) {
      setError("Enter an account name.");
      return;
    }
    setLoading(true);
    try {
      await createFinancialAccount({
        tenantId: activeStore,
        name: name.trim(),
        accountType,
        openingBalance: Number(openingBalance) || 0,
      });
      setName("");
      setOpeningBalance("0");
      await load();
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to create financial account");
    } finally {
      setLoading(false);
    }
  };

  const onArchive = async (accountId: string) => {
    if (!activeStore) return;
    setLoading(true);
    try {
      await archiveFinancialAccount(activeStore, accountId);
      await load();
    } catch (nextError) {
      console.error(nextError);
      setError(nextError instanceof Error ? nextError.message : "Unable to archive financial account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <CardTitle>Financial Accounts</CardTitle>
          <CardDescription>Manage the business money buckets used by payments and expenses.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_140px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="financial-account-name">Name</Label>
            <Input id="financial-account-name" value={name} onChange={(event) => setName(event.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="financial-account-type">Type</Label>
            <Select id="financial-account-type" value={accountType} onChange={(event) => setAccountType(event.target.value as FinancialAccountRow["accountType"])} disabled={loading}>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="UPI">UPI</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="financial-account-opening">Opening Balance</Label>
            <Input id="financial-account-opening" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} inputMode="decimal" disabled={loading} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void onCreate()} disabled={loading}>
              {loading ? "Saving..." : "Add Account"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className="p-2">
            <CardContent className="space-y-2 p-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{account.name}</p>
                  <p className="text-[11px] text-muted-foreground">{account.accountType.replace("_", " ")}</p>
                </div>
                {!account.isActive ? (
                  <span className="rounded-full border border-border/80 px-2 py-0.5 text-[10px] text-muted-foreground">Archived</span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                Opening: {formatCurrency(account.openingBalance)}
              </div>
              <div className="text-sm font-semibold text-foreground">
                Current: {formatCurrency(account.currentBalance)}
              </div>
              {account.isActive ? (
                <Button type="button" variant="outline" size="sm" onClick={() => void onArchive(account.id)} disabled={loading}>
                  Archive
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
