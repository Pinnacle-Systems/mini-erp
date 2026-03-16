import { useMemo } from "react";

type LicenseCapabilityPicklistProps = {
  capabilities: readonly string[];
  bundleCapabilities: readonly string[];
  addOnCapabilities: string[];
  removedCapabilities: string[];
  disabled?: boolean;
  onAddOnCapabilitiesChange: (next: string[]) => void;
  onRemovedCapabilitiesChange: (next: string[]) => void;
};

export function LicenseCapabilityPicklist({
  capabilities,
  bundleCapabilities,
  addOnCapabilities,
  removedCapabilities,
  disabled = false,
  onAddOnCapabilitiesChange,
  onRemovedCapabilitiesChange,
}: LicenseCapabilityPicklistProps) {
  const bundleSet = useMemo(() => new Set(bundleCapabilities), [bundleCapabilities]);
  const effectiveSet = useMemo(() => {
    const next = new Set(bundleCapabilities);
    for (const key of addOnCapabilities) next.add(key);
    for (const key of removedCapabilities) next.delete(key);
    return next;
  }, [bundleCapabilities, addOnCapabilities, removedCapabilities]);

  const selectedCount = useMemo(
    () => capabilities.filter((capability) => effectiveSet.has(capability)).length,
    [capabilities, effectiveSet],
  );

  const publishFromEffective = (nextEffective: Set<string>) => {
    const nextAddOn = capabilities.filter(
      (capability) => nextEffective.has(capability) && !bundleSet.has(capability),
    );
    const nextRemoved = capabilities.filter(
      (capability) => !nextEffective.has(capability) && bundleSet.has(capability),
    );
    onAddOnCapabilitiesChange(nextAddOn);
    onRemovedCapabilitiesChange(nextRemoved);
  };

  const toggleCapability = (capability: string) => {
    const nextEffective = new Set(effectiveSet);
    if (nextEffective.has(capability)) {
      nextEffective.delete(capability);
    } else {
      nextEffective.add(capability);
    }
    publishFromEffective(nextEffective);
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="text-[10px] text-muted-foreground">Feature Access</div>
        <div className="text-[10px] text-muted-foreground">
          {selectedCount} of {capabilities.length} enabled
        </div>
      </div>

      <div className="max-h-[18.5rem] overflow-y-auto rounded-md border border-[#d7e2ef] bg-[#fbfdff] p-1.5">
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((capability) => {
            const isSelected = effectiveSet.has(capability);

            return (
              <button
                key={capability}
                type="button"
                onClick={() => toggleCapability(capability)}
                disabled={disabled}
                aria-pressed={isSelected}
                className={`flex min-h-8 items-center rounded-md border px-2 text-left text-[10px] transition ${
                  isSelected
                    ? "border-[#2f6fb7] bg-[#edf4fb] font-medium text-[#1f4167]"
                    : "border-[#c6d5e6] bg-white text-foreground"
                } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">{capability}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
