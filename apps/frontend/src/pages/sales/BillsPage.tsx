import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { IconButton } from "../../design-system/atoms/IconButton";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import {
  DenseTable,
  DenseTableBody,
  DenseTableCell,
  DenseTableHead,
  DenseTableHeaderCell,
  DenseTableRow,
} from "../../design-system/molecules/DenseTable";
import { useSessionStore } from "../../features/auth/session-business";

type BillLine = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

type SavedBillDraft = {
  id: string;
  billNumber: string;
  customerName: string;
  notes: string;
  savedAt: string;
  lines: BillLine[];
};

const STORAGE_KEY_PREFIX = "mini_erp_sales_bill_drafts_v1";

const createLine = (): BillLine => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unitPrice: "",
  taxRate: "0",
});

const createBillNumber = (count: number) =>
  `SB-${String(count + 1).padStart(4, "0")}`;

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getLineTotals = (line: BillLine) => {
  const quantity = Math.max(0, toNumber(line.quantity));
  const unitPrice = Math.max(0, toNumber(line.unitPrice));
  const taxRate = Math.max(0, toNumber(line.taxRate));
  const subTotal = quantity * unitPrice;
  const taxTotal = subTotal * (taxRate / 100);
  return {
    subTotal,
    taxTotal,
    total: subTotal + taxTotal,
  };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const hasLineContent = (line: BillLine) =>
  Boolean(
    line.description.trim() ||
      line.unitPrice.trim() ||
      (line.quantity.trim() && line.quantity.trim() !== "0"),
  );

const normalizeLines = (lines: BillLine[]) => {
  const meaningfulLines = lines.filter(hasLineContent);
  return meaningfulLines.length > 0
    ? meaningfulLines.map((line) => ({
        ...line,
        description: line.description.trim(),
        quantity: line.quantity.trim() || "1",
        unitPrice: line.unitPrice.trim() || "0",
        taxRate: line.taxRate.trim() || "0",
      }))
    : [];
};

const loadStoredDrafts = (activeStore: string | null) => {
  if (!activeStore || typeof window === "undefined") {
    return [] as SavedBillDraft[];
  }

  try {
    const storedValue = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:${activeStore}`);
    return storedValue ? ((JSON.parse(storedValue) as SavedBillDraft[]) ?? []) : [];
  } catch {
    return [];
  }
};

export function BillsPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const businesses = useSessionStore((state) => state.businesses);
  const activeBusiness = businesses.find((business) => business.id === activeStore) ?? null;

  return (
    <BillsWorkspace
      key={activeStore ?? "no-store"}
      activeStore={activeStore}
      activeBusinessName={activeBusiness?.name ?? "No business selected"}
    />
  );
}

function BillsWorkspace({
  activeStore,
  activeBusinessName,
}: {
  activeStore: string | null;
  activeBusinessName: string;
}) {
  const [initialDrafts] = useState<SavedBillDraft[]>(() => loadStoredDrafts(activeStore));
  const [drafts, setDrafts] = useState<SavedBillDraft[]>(initialDrafts);
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [billNumber, setBillNumber] = useState(() => createBillNumber(initialDrafts.length));
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([createLine()]);
  const [saveMessage, setSaveMessage] = useState<string | null>(
    activeStore ? null : "Select a business to start a bill.",
  );

  const storageKey = activeStore ? `${STORAGE_KEY_PREFIX}:${activeStore}` : null;

  const totals = lines.reduce(
    (summary, line) => {
      const lineTotals = getLineTotals(line);
      summary.subTotal += lineTotals.subTotal;
      summary.taxTotal += lineTotals.taxTotal;
      summary.grandTotal += lineTotals.total;
      return summary;
    },
    { subTotal: 0, taxTotal: 0, grandTotal: 0 },
  );

  const persistDrafts = (nextDrafts: SavedBillDraft[]) => {
    setDrafts(nextDrafts);
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
    }
  };

  const resetEditor = (nextDraftCount: number) => {
    setActiveDraftId(null);
    setBillNumber(createBillNumber(nextDraftCount));
    setCustomerName("");
    setNotes("");
    setLines([createLine()]);
  };

  const openNewDraft = () => {
    resetEditor(drafts.length);
    setSaveMessage(activeStore ? null : "Select a business to start a bill.");
    setViewMode("editor");
  };

  const saveDraft = () => {
    if (!storageKey) {
      setSaveMessage("Select a business before saving a bill.");
      return;
    }

    if (!customerName.trim()) {
      setSaveMessage("Add a customer name before saving the bill draft.");
      return;
    }

    const normalizedLines = normalizeLines(lines);
    if (normalizedLines.length === 0) {
      setSaveMessage("Add at least one line with an item or amount before saving.");
      return;
    }

    const nextDraft: SavedBillDraft = {
      id: activeDraftId ?? crypto.randomUUID(),
      billNumber: billNumber.trim() || createBillNumber(drafts.length),
      customerName: customerName.trim(),
      notes: notes.trim(),
      savedAt: new Date().toISOString(),
      lines: normalizedLines,
    };

    const nextDrafts = activeDraftId
      ? drafts.map((draft) => (draft.id === activeDraftId ? nextDraft : draft))
      : [nextDraft, ...drafts];

    persistDrafts(nextDrafts);
    setActiveDraftId(nextDraft.id);
    setBillNumber(nextDraft.billNumber);
    setLines(nextDraft.lines);
    setSaveMessage("Draft saved locally on this device.");
  };

  const loadDraft = (draft: SavedBillDraft) => {
    setActiveDraftId(draft.id);
    setBillNumber(draft.billNumber);
    setCustomerName(draft.customerName);
    setNotes(draft.notes);
    setLines(draft.lines.map((line) => ({ ...line })));
    setSaveMessage(null);
    setViewMode("editor");
  };

  const removeDraft = (draftId: string) => {
    const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
    persistDrafts(nextDrafts);

    if (draftId === activeDraftId) {
      resetEditor(nextDrafts.length);
      setSaveMessage("Draft removed.");
    }
  };

  const updateLine = (lineId: string, field: keyof BillLine, value: string) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  };

  const removeLine = (lineId: string) => {
    setLines((currentLines) => {
      if (currentLines.length === 1) {
        return [createLine()];
      }
      return currentLines.filter((line) => line.id !== lineId);
    });
  };

  if (viewMode === "list") {
    return (
      <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
        <div className="flex flex-col rounded-xl border border-border/85 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:min-h-0 lg:flex-1">
          <div className="flex flex-col gap-2 border-b border-border/70 pb-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-sm font-semibold text-foreground">Sales Bills</h1>
              <p className="text-xs text-muted-foreground">
                Recent bill drafts stay local until the backend posting flow is wired.
              </p>
            </div>
            <Button type="button" size="sm" onClick={openNewDraft}>
              Create Bill
            </Button>
          </div>

          <div className="space-y-2 pt-2 lg:hidden">
            {drafts.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                No recent bills yet. Create a bill to start this transaction flow.
              </div>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    draft.id === activeDraftId
                      ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
                      : "border-border/70 bg-white text-foreground"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{draft.billNumber}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {draft.customerName}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {draft.lines.length} line{draft.lines.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{new Date(draft.savedAt).toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 py-0 font-semibold text-[#1f4167] hover:bg-transparent"
                        onClick={() => loadDraft(draft)}
                      >
                        Open
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 py-0 font-semibold text-[#8a2b2b] hover:bg-transparent"
                        onClick={() => removeDraft(draft.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {drafts.length === 0 ? (
              <div className="mt-2 rounded-md border border-dashed border-border/80 bg-slate-50 px-2 py-3 text-xs text-muted-foreground">
                No recent bills yet. Create a bill to start this transaction flow.
              </div>
            ) : (
              <DenseTable className="mt-2 rounded-xl border-border/80">
                <DenseTableHead>
                  <tr>
                    <DenseTableHeaderCell className="w-[18%]">Bill</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[26%]">Customer</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[14%]">Lines</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[24%]">Saved</DenseTableHeaderCell>
                    <DenseTableHeaderCell className="w-[18%] text-right">Actions</DenseTableHeaderCell>
                  </tr>
                </DenseTableHead>
                <DenseTableBody>
                  {drafts.map((draft) => (
                    <DenseTableRow key={draft.id}>
                      <DenseTableCell className="font-semibold text-foreground">
                        {draft.billNumber}
                      </DenseTableCell>
                      <DenseTableCell>{draft.customerName}</DenseTableCell>
                      <DenseTableCell>
                        {draft.lines.length} line{draft.lines.length === 1 ? "" : "s"}
                      </DenseTableCell>
                      <DenseTableCell>
                        {new Date(draft.savedAt).toLocaleString()}
                      </DenseTableCell>
                      <DenseTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            type="button"
                            icon={Eye}
                            variant="ghost"
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#1f4167] hover:bg-white/55"
                            onClick={() => loadDraft(draft)}
                            aria-label={`Open ${draft.billNumber}`}
                            title="Open"
                          />
                          <IconButton
                            type="button"
                            icon={Trash2}
                            variant="ghost"
                            className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#8a2b2b] hover:bg-white/55"
                            onClick={() => removeDraft(draft.id)}
                            aria-label={`Delete ${draft.billNumber}`}
                            title="Delete"
                          />
                        </div>
                      </DenseTableCell>
                    </DenseTableRow>
                  ))}
                </DenseTableBody>
              </DenseTable>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <div className="flex min-h-0 flex-col rounded-xl border border-border/85 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-1 lg:overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/70 pb-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-sm font-semibold text-foreground">
              {activeDraftId ? "Edit Bill" : "Create Bill"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Enter bill details, then review the summary directly below the line items.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setViewMode("list")}>
              Back to Recent
            </Button>
            <Button type="button" size="sm" onClick={saveDraft}>
              Save Draft ({normalizeLines(lines).length || 1})
            </Button>
          </div>
        </div>

        <div className="grid gap-2 py-2 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          <div className="space-y-1">
            <Label htmlFor="sales-bill-number">Bill number</Label>
            <Input
              id="sales-bill-number"
              value={billNumber}
              onChange={(event) => setBillNumber(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sales-bill-customer">Customer</Label>
            <Input
              id="sales-bill-customer"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Customer name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sales-bill-notes">Notes</Label>
            <Input
              id="sales-bill-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional internal note"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 lg:overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Line Items
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((currentLines) => [...currentLines, createLine()])}
            >
              Add Line
            </Button>
          </div>

          <div className="space-y-2 lg:hidden">
            {lines.map((line, index) => {
              const lineTotals = getLineTotals(line);
              return (
                <div key={line.id} className="rounded-lg border border-border/80 bg-slate-50 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-foreground">Line {index + 1}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 py-0 text-[11px] font-semibold text-[#8a2b2b] hover:bg-transparent"
                      onClick={() => removeLine(line.id)}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`sales-line-mobile-description-${line.id}`}>
                        Description
                      </Label>
                      <Input
                        id={`sales-line-mobile-description-${line.id}`}
                        value={line.description}
                        onChange={(event) =>
                          updateLine(line.id, "description", event.target.value)
                        }
                        placeholder="Item or service"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`sales-line-mobile-qty-${line.id}`}>Qty</Label>
                        <Input
                          id={`sales-line-mobile-qty-${line.id}`}
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.id, "quantity", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`sales-line-mobile-rate-${line.id}`}>Rate</Label>
                        <Input
                          id={`sales-line-mobile-rate-${line.id}`}
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.id, "unitPrice", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`sales-line-mobile-tax-${line.id}`}>Tax %</Label>
                        <Input
                          id={`sales-line-mobile-tax-${line.id}`}
                          value={line.taxRate}
                          onChange={(event) =>
                            updateLine(line.id, "taxRate", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                    <div className="rounded-md border border-border/70 bg-white px-2 py-1.5 text-xs text-muted-foreground">
                      Line total: {formatCurrency(lineTotals.total)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DenseTable className="rounded-xl border-border/80">
            <DenseTableHead>
              <tr>
                <DenseTableHeaderCell className="w-[42%]">Description</DenseTableHeaderCell>
                <DenseTableHeaderCell className="w-[12%]">Qty</DenseTableHeaderCell>
                <DenseTableHeaderCell className="w-[16%]">Rate</DenseTableHeaderCell>
                <DenseTableHeaderCell className="w-[12%]">Tax %</DenseTableHeaderCell>
                <DenseTableHeaderCell className="w-[13%] text-right">Total</DenseTableHeaderCell>
                <DenseTableHeaderCell className="w-[5%] text-right"> </DenseTableHeaderCell>
              </tr>
            </DenseTableHead>
            <DenseTableBody>
              {lines.map((line) => {
                const lineTotals = getLineTotals(line);
                return (
                  <DenseTableRow key={line.id}>
                    <DenseTableCell>
                      <Input
                        value={line.description}
                        onChange={(event) =>
                          updateLine(line.id, "description", event.target.value)
                        }
                        placeholder="Item or service"
                      />
                    </DenseTableCell>
                    <DenseTableCell>
                      <Input
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.id, "quantity", event.target.value)
                        }
                        inputMode="decimal"
                      />
                    </DenseTableCell>
                    <DenseTableCell>
                      <Input
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateLine(line.id, "unitPrice", event.target.value)
                        }
                        inputMode="decimal"
                      />
                    </DenseTableCell>
                    <DenseTableCell>
                      <Input
                        value={line.taxRate}
                        onChange={(event) =>
                          updateLine(line.id, "taxRate", event.target.value)
                        }
                        inputMode="decimal"
                      />
                    </DenseTableCell>
                    <DenseTableCell className="text-right font-semibold text-foreground">
                      {formatCurrency(lineTotals.total)}
                    </DenseTableCell>
                    <DenseTableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 py-0 text-[11px] font-semibold text-[#8a2b2b] hover:bg-transparent"
                        onClick={() => removeLine(line.id)}
                      >
                        Remove
                      </Button>
                    </DenseTableCell>
                  </DenseTableRow>
                );
              })}
            </DenseTableBody>
          </DenseTable>

          <div className="rounded-xl border border-border/85 bg-white p-2">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <div>
                <h2 className="text-xs font-semibold text-foreground">Bill Summary</h2>
                <p className="text-[11px] text-muted-foreground">{activeBusinessName}</p>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.subTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.taxTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-xs">
                <span className="font-semibold text-foreground">Grand total</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>
              {saveMessage ? (
                <div className="rounded-md border border-border/70 bg-slate-50 px-2 py-1.5 text-[11px] text-muted-foreground">
                  {saveMessage}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
