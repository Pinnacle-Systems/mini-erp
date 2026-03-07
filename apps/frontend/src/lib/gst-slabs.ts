export const GST_SLAB_VALUES = [
  "0%",
  "0.25%",
  "3%",
  "5%",
  "12%",
  "18%",
  "28%",
  "40%",
  "EXEMPT",
] as const;

export type GstSlabOption = (typeof GST_SLAB_VALUES)[number];

export const GST_SLAB_OPTIONS: ReadonlyArray<{
  value: GstSlabOption;
  label: string;
}> = GST_SLAB_VALUES.map((value) => ({
  value,
  label: value === "EXEMPT" ? "Exempt" : value,
}));

export const formatGstSlabLabel = (value: string | null | undefined) => {
  const normalized = normalizeGstSlab(value);
  if (!normalized) return "";
  return GST_SLAB_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized;
};

export const normalizeGstSlab = (value: string | null | undefined): GstSlabOption | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase();
  if (normalized === "exempt") return "EXEMPT";

  const matchedPercentage = GST_SLAB_VALUES.find(
    (option) => option !== "EXEMPT" && option.toLowerCase() === normalized,
  );
  return matchedPercentage ?? null;
};
