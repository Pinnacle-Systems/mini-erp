import { Plus, Trash2 } from "lucide-react";
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
  const items = locations.length > 0 ? locations : [{ ...createEmptyLocation(), isDefault: true }];

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
    onChange([
      ...items.map((location) => ({ ...location })),
      createEmptyLocation(),
    ]);
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
  };

  return (
    <fieldset className="space-y-1.5 rounded-lg border border-[#d7e2ef] bg-white p-2">
      <legend className="m-0 rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
        Business Locations
      </legend>
      <div className="space-y-2">
        {items.map((location, index) => (
          <div key={location.id ?? `draft-${index}`} className="rounded-md border border-[#d7e2ef] p-2">
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  location.isDefault
                    ? "border-[#2f6fb7] bg-[#edf4fb] text-[#1f4167]"
                    : "border-[#c6d5e6] text-muted-foreground"
                }`}
                onClick={() => setDefaultLocation(index)}
                disabled={disabled || !editable}
              >
                {location.isDefault ? "Default location" : "Set default"}
              </button>
              <div className="ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeLocation(index)}
                  disabled={disabled || !editable || items.length <= 1}
                  className="h-7 gap-1 px-2 text-[11px]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
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
        ))}
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
