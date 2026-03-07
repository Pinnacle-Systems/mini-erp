// TODO: Replace this hardcoded INR display with a business-level currency display setting.
export const formatCurrencyDisplay = (amount: number | null, currency?: string) => {
  if (amount === null || !Number.isFinite(amount)) return "-";

  const normalizedCurrency = currency?.trim().toUpperCase() || "INR";
  if (normalizedCurrency === "INR") {
    return `₹${amount.toFixed(2)}`;
  }

  return `${normalizedCurrency} ${amount.toFixed(2)}`;
};
