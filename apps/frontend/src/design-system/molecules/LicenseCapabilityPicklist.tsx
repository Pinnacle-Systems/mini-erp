import { useMemo, useState } from "react";

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
  const [mobileView, setMobileView] = useState<"HAS" | "MISSING">("HAS");

  const bundleSet = useMemo(() => new Set(bundleCapabilities), [bundleCapabilities]);
  const effectiveSet = useMemo(() => {
    const next = new Set(bundleCapabilities);
    for (const key of addOnCapabilities) next.add(key);
    for (const key of removedCapabilities) next.delete(key);
    return next;
  }, [bundleCapabilities, addOnCapabilities, removedCapabilities]);

  const hasCapabilities = useMemo(
    () => capabilities.filter((capability) => effectiveSet.has(capability)),
    [capabilities, effectiveSet],
  );
  const missingCapabilities = useMemo(
    () => capabilities.filter((capability) => !effectiveSet.has(capability)),
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
    <div className="grid gap-2">
      <div className="rounded-md border border-[#d7e2ef] bg-[#f7fbff] p-2 lg:hidden">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMobileView("HAS")}
            className={`h-8 rounded-md px-2 text-xs ${
              mobileView === "HAS"
                ? "bg-[#2f6fb7] text-white"
                : "border border-[#c6d5e6] bg-white text-foreground"
            }`}
          >
            Has ({hasCapabilities.length})
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMobileView("MISSING")}
            className={`h-8 rounded-md px-2 text-xs ${
              mobileView === "MISSING"
                ? "bg-[#2f6fb7] text-white"
                : "border border-[#c6d5e6] bg-white text-foreground"
            }`}
          >
            Doesn&apos;t have ({missingCapabilities.length})
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Tap a capability to move it to the other list.
        </p>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-[#c6d5e6] bg-white p-1">
          <div className="grid gap-1">
            {(mobileView === "HAS" ? hasCapabilities : missingCapabilities).map((capability) => (
              <button
                key={`${mobileView}-${capability}`}
                type="button"
                onClick={() => toggleCapability(capability)}
                disabled={disabled}
                className="flex min-h-8 items-center rounded-md border border-[#e5edf7] px-2 text-left text-xs text-foreground"
              >
                <span className="min-w-0 flex-1 truncate">{capability}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <p className="mb-1 text-[10px] text-muted-foreground">
          Click or select a capability to move it.
        </p>
      </div>

      <div className="hidden gap-2 lg:grid lg:grid-cols-2">
        <div className="grid gap-1 text-[10px] text-muted-foreground">
          <span>Has capabilities ({hasCapabilities.length})</span>
          <div className="h-[12rem] overflow-y-auto rounded-md border border-[#c6d5e6] bg-white p-1">
            <div className="grid gap-1">
              {hasCapabilities.map((capability) => (
                <button
                  key={`desktop-has-${capability}`}
                  type="button"
                  onClick={() => toggleCapability(capability)}
                  disabled={disabled}
                  className="flex min-h-7 items-center rounded-md border border-[#e5edf7] px-2 text-left text-[11px] text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">{capability}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-1 text-[10px] text-muted-foreground">
          <span>Doesn&apos;t have capabilities ({missingCapabilities.length})</span>
          <div className="h-[12rem] overflow-y-auto rounded-md border border-[#c6d5e6] bg-white p-1">
            <div className="grid gap-1">
              {missingCapabilities.map((capability) => (
                <button
                  key={`desktop-missing-${capability}`}
                  type="button"
                  onClick={() => toggleCapability(capability)}
                  disabled={disabled}
                  className="flex min-h-7 items-center rounded-md border border-[#e5edf7] px-2 text-left text-[11px] text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">{capability}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
