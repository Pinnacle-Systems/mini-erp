import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { Select } from "../atoms/Select";
import { INDIA_STATES } from "../../lib/india-states";

export type BusinessLocationDraft = {
  id?: string;
  name: string;
  phoneNumber: string;
  email: string;
  gstin: string;
  state: string;
  pincode: string;
  address: string;
  isDefault: boolean;
};

type BusinessLocationsPaneProps = {
  locations: BusinessLocationDraft[];
  disabled: boolean;
  editable: boolean;
  onChange: (locations: BusinessLocationDraft[]) => void;
};

const createEmptyLocation = (): BusinessLocationDraft => ({
  name: "",
  phoneNumber: "",
  email: "",
  gstin: "",
  state: "",
  pincode: "",
  address: "",
  isDefault: false,
});

export function BusinessLocationsPane({
  locations,
  disabled,
  editable,
  onChange,
}: BusinessLocationsPaneProps) {
  const items =
    locations.length > 0 ? locations : [{ ...createEmptyLocation(), isDefault: true }];
  const [expandedIndex, setExpandedIndex] = useState(0);
  const activeExpandedIndex = Math.min(expandedIndex, items.length - 1);

  const updateLocation = (
    index: number,
    update: Partial<BusinessLocationDraft>,
  ) => {
    const next = items.map((location, itemIndex) => {
      if (itemIndex !== index) return location;
      return { ...location, ...update };
    });
    onChange(next);
  };

  const setDefaultLocation = (index: number) => {
    onChange(
      items.map((location, itemIndex) => ({
        ...location,
        isDefault: itemIndex === index,
      })),
    );
  };

  const addLocation = () => {
    const next = [
      ...items.map((location) => ({ ...location })),
      createEmptyLocation(),
    ];
    onChange(next);
    setExpandedIndex(next.length - 1);
  };

  const removeLocation = (index: number) => {
    if (items.length <= 1) {
      return;
    }

    const next = items.filter((_, itemIndex) => itemIndex !== index);
    if (!next.some((location) => location.isDefault) && next[0]) {
      next[0].isDefault = true;
    }
    onChange(next);
    setExpandedIndex((current) => {
      if (current === index) {
        return Math.max(0, index - 1);
      }
      if (current > index) {
        return current - 1;
      }
      return current;
    });
  };

  return (
    <fieldset className="space-y-1.5 rounded-lg border border-[#d7e2ef] bg-white p-2">
      <legend className="m-0 rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
        Business Locations
      </legend>

      <div className="space-y-2">
        {items.map((location, index) => {
          const isExpanded = activeExpandedIndex === index;
          const summaryName = location.name.trim() || `Location ${index + 1}`;
          const summaryPhone = location.phoneNumber.trim() || "No phone";
          const summaryState = location.state.trim() || "No state";

          return (
            <div key={location.id ?? `draft-${index}`} className="rounded-md border border-[#d7e2ef]">
              <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md text-[11px] font-medium text-[#1f4167]"
                  onClick={() => setExpandedIndex(index)}
                  disabled={disabled}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span>{summaryName}</span>
                </button>

                {location.isDefault ? (
                  <span className="rounded-full border border-[#2f6fb7] bg-[#edf4fb] px-2 py-0.5 text-[10px] font-medium text-[#1f4167]">
                    Default
                  </span>
                ) : null}

                <span className="text-[10px] text-muted-foreground">{summaryState}</span>
                <span className="text-[10px] text-muted-foreground">{summaryPhone}</span>

                <div className="ml-auto flex items-center gap-1">
                  {!location.isDefault ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDefaultLocation(index)}
                      disabled={disabled || !editable}
                      className="h-7 px-2 text-[10px]"
                    >
                      Set default
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeLocation(index)}
                    disabled={disabled || !editable || items.length <= 1}
                    className="h-7 gap-1 px-2 text-[10px]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>

              {isExpanded ? (
                <div className="border-t border-[#d7e2ef] px-2 py-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Location name</Label>
                      <Input
                        value={location.name}
                        onChange={(event) => updateLocation(index, { name: event.target.value })}
                        disabled={disabled}
                        readOnly={!editable}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input
                        value={location.phoneNumber}
                        onChange={(event) =>
                          updateLocation(index, { phoneNumber: event.target.value })
                        }
                        disabled={disabled}
                        readOnly={!editable}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        value={location.email}
                        onChange={(event) => updateLocation(index, { email: event.target.value })}
                        disabled={disabled}
                        readOnly={!editable}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>GSTIN</Label>
                      <Input
                        value={location.gstin}
                        onChange={(event) => updateLocation(index, { gstin: event.target.value })}
                        disabled={disabled}
                        readOnly={!editable}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>State</Label>
                      {editable ? (
                        <Select
                          value={location.state}
                          onChange={(event) => updateLocation(index, { state: event.target.value })}
                          disabled={disabled}
                          className="h-8 text-xs"
                        >
                          <option value="">Select state</option>
                          {INDIA_STATES.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input value={location.state} disabled={disabled} readOnly className="h-8 text-xs" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label>Pincode</Label>
                      <Input
                        value={location.pincode}
                        onChange={(event) =>
                          updateLocation(index, {
                            pincode: event.target.value.replace(/\D/g, "").slice(0, 6),
                          })
                        }
                        inputMode="numeric"
                        maxLength={6}
                        disabled={disabled}
                        readOnly={!editable}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <Label>Address</Label>
                      <Input
                        value={location.address}
                        onChange={(event) => updateLocation(index, { address: event.target.value })}
                        disabled={disabled}
                        readOnly={!editable}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          onClick={addLocation}
          disabled={disabled || !editable}
          className="h-8 gap-1.5 px-2 text-[11px]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add location
        </Button>
      </div>
    </fieldset>
  );
}
