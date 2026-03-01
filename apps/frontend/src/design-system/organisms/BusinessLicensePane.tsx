import { Save } from "lucide-react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { Select } from "../atoms/Select";
import { LicenseCapabilityPicklist } from "../molecules/LicenseCapabilityPicklist";
import {
  BUNDLE_CAPABILITY_MAP,
  BUNDLE_KEYS,
  CAPABILITY_KEYS,
  type BundleKey,
  type CapabilityKey,
} from "../../features/admin/businesses";

type UserLimitType = "UNLIMITED" | "MAX_USERS" | "MAX_CONCURRENT_USERS";

type BusinessLicensePaneProps = {
  beginsOn: string;
  endsOn: string;
  bundleKey: BundleKey;
  addOnCapabilities: CapabilityKey[];
  removedCapabilities: CapabilityKey[];
  userLimitType: UserLimitType;
  userLimitValue: string;
  disabled: boolean;
  onBeginsOnChange: (value: string) => void;
  onEndsOnChange: (value: string) => void;
  onBundleKeyChange: (value: BundleKey) => void;
  onAddOnCapabilitiesChange: (value: CapabilityKey[]) => void;
  onRemovedCapabilitiesChange: (value: CapabilityKey[]) => void;
  onUserLimitTypeChange: (value: UserLimitType) => void;
  onUserLimitValueChange: (value: string) => void;
  onSave?: () => void;
  saveLabel?: string;
};

export function BusinessLicensePane({
  beginsOn,
  endsOn,
  bundleKey,
  addOnCapabilities,
  removedCapabilities,
  userLimitType,
  userLimitValue,
  disabled,
  onBeginsOnChange,
  onEndsOnChange,
  onBundleKeyChange,
  onAddOnCapabilitiesChange,
  onRemovedCapabilitiesChange,
  onUserLimitTypeChange,
  onUserLimitValueChange,
  onSave,
  saveLabel = "Save License",
}: BusinessLicensePaneProps) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-[#d7e2ef] bg-white p-2">
      <legend className="m-0 rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
        License
      </legend>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-2">
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="grid gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
              <Label htmlFor="license-begins-on" className="text-[11px] text-muted-foreground lg:text-[10px]">
                Begin date
              </Label>
              <Input
                id="license-begins-on"
                type="date"
                value={beginsOn}
                onChange={(event) => onBeginsOnChange(event.target.value)}
                disabled={disabled}
                aria-label="Begin date"
                className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
              />
            </div>
            <div className="grid gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
              <Label htmlFor="license-ends-on" className="text-[11px] text-muted-foreground lg:text-[10px]">
                End date
              </Label>
              <Input
                id="license-ends-on"
                type="date"
                value={endsOn}
                onChange={(event) => onEndsOnChange(event.target.value)}
                disabled={disabled}
                aria-label="End date"
                className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
              />
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_4.75rem] lg:gap-4">
            <div className="grid min-w-0 gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
              <Label htmlFor="license-user-limit-type" className="text-[11px] text-muted-foreground lg:text-[10px]">
                User limit mode
              </Label>
              <Select
                id="license-user-limit-type"
                value={userLimitType}
                onChange={(event) =>
                  onUserLimitTypeChange(event.target.value as UserLimitType)
                }
                disabled={disabled}
                aria-label="User limit mode"
                className="h-8 w-full min-w-0 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
              >
                <option value="UNLIMITED">Unlimited users</option>
                <option value="MAX_USERS">Max users per business</option>
                <option value="MAX_CONCURRENT_USERS">Max concurrent users</option>
              </Select>
            </div>
            {userLimitType !== "UNLIMITED" ? (
              <div className="grid min-w-0 gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                <Label htmlFor="license-user-limit-value" className="text-[11px] text-muted-foreground lg:text-[10px]">
                  User limit
                </Label>
                <Input
                  id="license-user-limit-value"
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={userLimitValue}
                  onChange={(event) =>
                    onUserLimitValueChange(
                      event.target.value.replace(/\D/g, "").slice(0, 3),
                    )
                  }
                  disabled={disabled}
                  aria-label="User limit"
                  className="h-8 w-full min-w-0 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                />
              </div>
            ) : (
              <div />
            )}
          </div>
          <div className="hidden gap-1 text-[11px] text-muted-foreground lg:grid lg:text-[10px]">
            <Label htmlFor="license-bundle-desktop" className="text-[11px] text-muted-foreground lg:text-[10px]">
              Bundle
            </Label>
            <Select
              id="license-bundle-desktop"
              value={bundleKey}
              onChange={(event) => onBundleKeyChange(event.target.value as BundleKey)}
              disabled={disabled}
              aria-label="Bundle"
              className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
            >
              {BUNDLE_KEYS.map((currentBundleKey) => (
                <option key={currentBundleKey} value={currentBundleKey}>
                  {currentBundleKey}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid content-start gap-2">
          <div className="grid gap-1 text-[11px] text-muted-foreground lg:hidden">
            <Label htmlFor="license-bundle-mobile" className="text-[11px] text-muted-foreground lg:text-[10px]">
              Bundle
            </Label>
            <Select
              id="license-bundle-mobile"
              value={bundleKey}
              onChange={(event) => onBundleKeyChange(event.target.value as BundleKey)}
              disabled={disabled}
              aria-label="Bundle"
              className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
            >
              {BUNDLE_KEYS.map((currentBundleKey) => (
                <option key={currentBundleKey} value={currentBundleKey}>
                  {currentBundleKey}
                </option>
              ))}
            </Select>
          </div>

          <LicenseCapabilityPicklist
            capabilities={CAPABILITY_KEYS}
            bundleCapabilities={BUNDLE_CAPABILITY_MAP[bundleKey] ?? []}
            addOnCapabilities={addOnCapabilities}
            removedCapabilities={removedCapabilities}
            disabled={disabled}
            onAddOnCapabilitiesChange={(next) =>
              onAddOnCapabilitiesChange(next as CapabilityKey[])
            }
            onRemovedCapabilitiesChange={(next) =>
              onRemovedCapabilitiesChange(next as CapabilityKey[])
            }
          />
        </div>
      </div>
      {onSave ? (
        <Button
          variant="outline"
          onClick={onSave}
          disabled={disabled}
          className="w-full gap-1 text-[11px]"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveLabel}
        </Button>
      ) : null}
    </fieldset>
  );
}
