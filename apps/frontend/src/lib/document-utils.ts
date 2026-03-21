type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

type TaxedLine = {
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxMode: TaxMode;
};

type LineTotalsOptions = {
  round?: boolean;
  digits?: number;
};

const roundValue = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toNonNegativeNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const formatDocumentCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export const formatDocumentDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const parseDocumentTaxRate = (value: string | null | undefined) => {
  if (!value?.trim() || value === "EXEMPT") {
    return 0;
  }

  const normalized = value.endsWith("%") ? value.slice(0, -1) : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const calculateDocumentLineTotals = (
  line: TaxedLine,
  { round = true, digits = 2 }: LineTotalsOptions = {},
) => {
  const quantity = toNonNegativeNumber(line.quantity);
  const unitPrice = toNonNegativeNumber(line.unitPrice);
  const taxRate = parseDocumentTaxRate(line.taxRate);
  const grossAmount = round ? roundValue(quantity * unitPrice, digits) : quantity * unitPrice;

  if (line.taxMode === "INCLUSIVE" && taxRate > 0) {
    const subTotal = grossAmount / (1 + taxRate / 100);
    const taxTotal = grossAmount - subTotal;
    return {
      subTotal: round ? roundValue(subTotal, digits) : subTotal,
      taxTotal: round ? roundValue(taxTotal, digits) : taxTotal,
      total: grossAmount,
    };
  }

  const subTotal = grossAmount;
  const taxTotal = subTotal * (taxRate / 100);
  const total = subTotal + taxTotal;
  return {
    subTotal: round ? roundValue(subTotal, digits) : subTotal,
    taxTotal: round ? roundValue(taxTotal, digits) : taxTotal,
    total: round ? roundValue(total, digits) : total,
  };
};

export const formatPrefixedSequenceNumber = (
  prefix: string,
  nextNumber: number,
  digits = 4,
) => `${prefix}${String(nextNumber).padStart(digits, "0")}`;

export const parsePrefixedSequenceNumber = (value: string, prefix: string) => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedPrefix}(\\d+)$`).exec(value.trim().toUpperCase());
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getNextDocumentNumber = (
  prefix: string,
  documents: Array<Pick<{ billNumber: string }, "billNumber">>,
  digits = 4,
) => {
  const maxSequence = documents.reduce((max, document) => {
    const parsed = parsePrefixedSequenceNumber(document.billNumber, prefix);
    return parsed && parsed > max ? parsed : max;
  }, 0);

  return formatPrefixedSequenceNumber(prefix, maxSequence + 1, digits);
};
