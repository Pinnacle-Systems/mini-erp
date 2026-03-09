import type { SelectHTMLAttributes } from "react";
import { Select } from "../atoms/Select";
import { GST_SLAB_OPTIONS } from "../../lib/gst-slabs";

export type GstSlabSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  placeholderOption?: string;
};

export function GstSlabSelect({
  placeholderOption = "GST %",
  ...props
}: GstSlabSelectProps) {
  return (
    <Select {...props}>
      {placeholderOption && (
        <option value="" disabled>
          {placeholderOption}
        </option>
      )}
      {GST_SLAB_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
