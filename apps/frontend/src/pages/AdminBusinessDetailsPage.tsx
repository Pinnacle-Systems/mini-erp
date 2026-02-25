import { Pencil, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { LoadingOverlay } from "../design-system/atoms/LoadingOverlay";
import {
  Card,
  CardContent,
} from "../design-system/molecules/Card";
import { LicenseCapabilityPicklist } from "../design-system/molecules/LicenseCapabilityPicklist";
import { BusinessDetailsFormPanes } from "../design-system/organisms/BusinessDetailsFormPanes";
import { BusinessLogoPicker } from "../design-system/organisms/BusinessLogoPicker";
import {
  BUNDLE_CAPABILITY_MAP,
  CAPABILITY_KEYS,
  BUNDLE_KEYS,
  deleteAdminStore,
  getAdminStore,
  removeBusinessLogo,
  updateAdminStore,
  uploadBusinessLogo,
  type AdminStore,
  type BundleKey,
  type CapabilityKey,
} from "../features/admin/businesses";

export function AdminBusinessDetailsPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [business, setStore] = useState<AdminStore | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [detailsDraft, setDetailsDraft] = useState({
    phoneNumber: "",
    gstin: "",
    email: "",
    businessType: "",
    businessCategory: "",
    state: "",
    pincode: "",
    address: "",
  });
  const [moduleDraft, setModuleDraft] = useState({
    catalog: true,
    inventory: true,
    pricing: true,
  });
  const [licenseDraft, setLicenseDraft] = useState({
    beginsOn: "",
    endsOn: "",
    bundleKey: "SALES_LITE" as BundleKey,
    addOnCapabilities: [] as CapabilityKey[],
    removedCapabilities: [] as CapabilityKey[],
    userLimitType: "UNLIMITED" as "UNLIMITED" | "MAX_USERS" | "MAX_CONCURRENT_USERS",
    userLimitValue: "",
  });
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const showOverlayLoader = loading || saving;

  const applyDetailsDraft = (source: AdminStore) => {
    setDetailsDraft({
      phoneNumber: source.phoneNumber ?? "",
      gstin: source.gstin ?? "",
      email: source.email ?? "",
      businessType: source.businessType ?? "",
      businessCategory: source.businessCategory ?? "",
      state: source.state ?? "",
      pincode: source.pincode ?? "",
      address: source.address ?? "",
    });
  };

  const applyLicenseDraft = (source: AdminStore) => {
    setLicenseDraft({
      beginsOn: source.license?.beginsOn ?? "",
      endsOn: source.license?.endsOn ?? "",
      bundleKey: source.license?.bundleKey ?? "SALES_LITE",
      addOnCapabilities: source.license?.addOnCapabilities ?? [],
      removedCapabilities: source.license?.removedCapabilities ?? [],
      userLimitType: source.license?.userLimitType ?? "UNLIMITED",
      userLimitValue:
        source.license?.userLimitType && source.license.userLimitValue
          ? String(source.license.userLimitValue)
          : "",
    });
  };

  const loadStore = useCallback(async () => {
    if (!businessId) {
      setError("Business not found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getAdminStore(businessId);
      setStore(result);
      setNameDraft(result.name);
      applyDetailsDraft(result);
      setModuleDraft({
        catalog: result.modules?.catalog ?? true,
        inventory: result.modules?.inventory ?? true,
        pricing: result.modules?.pricing ?? true,
      });
      applyLicenseDraft(result);
      setIsEditingDetails(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load business",
      );
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const runMutation = async (operation: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await operation();
      await loadStore();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update business",
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!businessId) return;
    await runMutation(async () => {
      await deleteAdminStore(businessId);
    });
  };

  const onRestore = async () => {
    if (!businessId) return;
    await runMutation(async () => {
      await updateAdminStore(businessId, { isActive: true });
    });
  };

  const onToggleBusinessStatus = async (nextActive: boolean) => {
    if (!business) return;
    const isActive = !business.deletedAt;
    if (isActive === nextActive) return;

    if (!nextActive) {
      const confirmed = window.confirm(
        "Mark this business as inactive? You can restore it later.",
      );
      if (!confirmed) return;
      await onDelete();
      return;
    }

    await onRestore();
  };

  const onSaveModules = async () => {
    if (!businessId) return;
    await runMutation(async () => {
      await updateAdminStore(businessId, {
        modules: {
          catalog: moduleDraft.catalog,
          inventory: moduleDraft.inventory,
          pricing: moduleDraft.pricing,
        },
      });
    });
  };

  const onSaveLicense = async () => {
    if (!businessId) return;
    if (!licenseDraft.beginsOn || !licenseDraft.endsOn) {
      setError("License begin and end dates are required.");
      return;
    }
    if (licenseDraft.userLimitType !== "UNLIMITED") {
      const parsedLimit = Number(licenseDraft.userLimitValue);
      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 999) {
        setError("User limit must be a positive whole number up to 999.");
        return;
      }
    }
    const addOn = Array.from(new Set(licenseDraft.addOnCapabilities));
    const removed = Array.from(
      new Set(licenseDraft.removedCapabilities.filter((capability) => !addOn.includes(capability))),
    );
    await runMutation(async () => {
      await updateAdminStore(businessId, {
        license: {
          beginsOn: licenseDraft.beginsOn,
          endsOn: licenseDraft.endsOn,
          bundleKey: licenseDraft.bundleKey,
          addOnCapabilities: addOn,
          removedCapabilities: removed,
          userLimitType:
            licenseDraft.userLimitType === "UNLIMITED"
              ? null
              : licenseDraft.userLimitType,
          userLimitValue:
            licenseDraft.userLimitType === "UNLIMITED"
              ? null
              : Number(licenseDraft.userLimitValue),
        },
      });
    });
  };

  const onSaveDetails = async () => {
    if (!businessId) return;
    if (!nameDraft.trim()) {
      setError("Business name is required.");
      return;
    }
    await runMutation(async () => {
      await updateAdminStore(businessId, {
        name: nameDraft.trim(),
        phoneNumber: detailsDraft.phoneNumber.trim() || null,
        gstin: detailsDraft.gstin.trim() || null,
        email: detailsDraft.email.trim() || null,
        businessType: detailsDraft.businessType.trim() || null,
        businessCategory: detailsDraft.businessCategory.trim() || null,
        state: detailsDraft.state.trim() || null,
        pincode: detailsDraft.pincode.trim() || null,
        address: detailsDraft.address.trim() || null,
      });
    });
    setIsEditingDetails(false);
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolvePromise, rejectPromise) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string" || !result.includes(",")) {
          rejectPromise(new Error("Invalid file payload"));
          return;
        }
        resolvePromise(result.split(",")[1] ?? "");
      };
      reader.onerror = () => rejectPromise(new Error("Unable to read file"));
      reader.readAsDataURL(file);
    });

  const onLogoFileChange = async (file: File) => {
    if (!businessId || uploadingLogo) {
      return;
    }

    setError(null);
    setUploadingLogo(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const result = await uploadBusinessLogo(businessId, {
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      });
      setStore((current) =>
        current ? { ...current, logo: result.logo } : current,
      );
      await loadStore();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to upload logo",
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const onRemoveLogo = async () => {
    if (!businessId || removingLogo || uploadingLogo) {
      return;
    }
    setError(null);
    setRemovingLogo(true);
    try {
      await removeBusinessLogo(businessId);
      setStore((current) => (current ? { ...current, logo: "" } : current));
      await loadStore();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove logo",
      );
    } finally {
      setRemovingLogo(false);
    }
  };

  const ownerDisplayValue =
    business?.owner?.name?.trim() || business?.owner?.phone || "";

  return (
    <section className="h-auto lg:h-full lg:min-h-0 lg:text-[12px]">
      <Card className="h-auto p-2 lg:h-full lg:min-h-0 lg:p-2">
        <CardContent className="relative h-auto space-y-2 lg:h-full lg:min-h-0 lg:[&_button]:text-[11px] lg:[&_input]:text-[11px] lg:[&_label]:text-[10px] lg:[&_p]:text-[11px] lg:[&_select]:text-[11px] lg:[&_span]:text-[11px]">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {!business && !loading ? (
            <p className="text-sm text-muted-foreground">Business not found.</p>
          ) : business ? (
            <div className="grid gap-2 lg:h-full lg:min-h-0 xl:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 p-2 lg:flex-nowrap">
                  <BusinessLogoPicker
                    logoUrl={business.logo || null}
                    disabled={saving || uploadingLogo || removingLogo}
                    removing={removingLogo}
                    onApplyLogoFile={onLogoFileChange}
                    onRemoveLogo={onRemoveLogo}
                  />
                  <div className="space-y-0.5">
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Use avatar icons to upload or remove logo.
                    </p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      PNG, JPG or WEBP up to 2MB.
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3 lg:ml-auto lg:w-auto lg:justify-end">
                    {!isEditingDetails ? (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingDetails(true)}
                        disabled={saving}
                        className="h-7 gap-1 px-2 text-[11px]"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit Details
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          onClick={onSaveDetails}
                          disabled={saving}
                          className="h-7 gap-1 px-2 text-[11px]"
                        >
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Save Details
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            applyDetailsDraft(business);
                            setIsEditingDetails(false);
                          }}
                          disabled={saving}
                          className="h-7 px-2 text-[11px]"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Active
                      </span>
                      <button
                        id="business-active-status"
                        type="button"
                        role="switch"
                        aria-checked={!business.deletedAt}
                        aria-label="Toggle business active status"
                        onClick={() => {
                          void onToggleBusinessStatus(
                            Boolean(business.deletedAt),
                          );
                        }}
                        disabled={saving}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6aa5eb]/35 disabled:cursor-not-allowed disabled:opacity-60 ${
                          !business.deletedAt
                            ? "border-[#2f6fb7] bg-[#4a8dd9]"
                            : "border-[#b8cbe0] bg-[#e7eff8]"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            !business.deletedAt
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <BusinessDetailsFormPanes
                  values={{
                    name: nameDraft,
                    ownerPhone: business.owner?.phone ?? "",
                    gstin: detailsDraft.gstin,
                    phoneNumber: detailsDraft.phoneNumber,
                    email: detailsDraft.email,
                    state: detailsDraft.state,
                    pincode: detailsDraft.pincode,
                    address: detailsDraft.address,
                    businessType: detailsDraft.businessType,
                    businessCategory: detailsDraft.businessCategory,
                  }}
                  editable={isEditingDetails}
                  disabled={saving}
                  idPrefix="business"
                  showOwnerPhoneInput={false}
                  ownerDisplay={
                    business.ownerId ? (
                      <Link
                        id="business-owner"
                        to={`/app/users/${business.ownerId}`}
                        className="flex h-8 items-center rounded-md text-xs leading-none text-[#24507e] underline underline-offset-2 transition hover:text-[#1f4167]"
                      >
                        {ownerDisplayValue || "View owner"}
                      </Link>
                    ) : (
                      <p
                        id="business-owner"
                        className="flex h-8 items-center text-xs leading-none text-muted-foreground"
                      >
                        Owner unavailable
                      </p>
                    )
                  }
                  onFieldChange={(field, value) => {
                    if (field === "name") {
                      setNameDraft(value);
                      return;
                    }
                    setDetailsDraft((current) => ({
                      ...current,
                      [field]: value,
                    }));
                  }}
                />
              </div>
              <div className="overflow-visible rounded-xl border border-[#d7e2ef] bg-white p-2 lg:min-h-0 lg:overflow-y-auto">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4a647f]">
                    Access Controls
                  </p>
                  <p className="text-xs font-semibold text-foreground">
                    Enabled Modules
                  </p>
                  <div className="grid gap-2">
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={moduleDraft.catalog}
                        onChange={(event) =>
                          setModuleDraft((current) => ({
                            ...current,
                            catalog: event.target.checked,
                          }))
                        }
                        disabled={saving}
                      />
                      Catalog
                    </label>
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={moduleDraft.inventory}
                        onChange={(event) =>
                          setModuleDraft((current) => ({
                            ...current,
                            inventory: event.target.checked,
                          }))
                        }
                        disabled={saving}
                      />
                      Inventory
                    </label>
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={moduleDraft.pricing}
                        onChange={(event) =>
                          setModuleDraft((current) => ({
                            ...current,
                            pricing: event.target.checked,
                          }))
                        }
                        disabled={saving}
                      />
                      Pricing
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    onClick={onSaveModules}
                    disabled={saving}
                    className="w-full gap-1 text-[11px]"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save Modules
                  </Button>
                </div>
                <div className="mt-4 space-y-2 border-t border-[#e3ebf5] pt-3">
                  <p className="text-xs font-semibold text-foreground">
                    Store License
                  </p>
                  <div className="grid gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                    <div className="grid content-start gap-1.5">
                      <div className="grid gap-2 lg:grid-cols-2">
                        <label className="grid gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                          Begin date
                          <input
                            type="date"
                            value={licenseDraft.beginsOn}
                            onChange={(event) =>
                              setLicenseDraft((current) => ({
                                ...current,
                                beginsOn: event.target.value,
                              }))
                            }
                            disabled={saving}
                            className="h-8 rounded-md border border-[#c6d5e6] px-2 text-xs text-foreground"
                          />
                        </label>
                        <label className="grid gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                          End date
                          <input
                            type="date"
                            value={licenseDraft.endsOn}
                            onChange={(event) =>
                              setLicenseDraft((current) => ({
                                ...current,
                                endsOn: event.target.value,
                              }))
                            }
                            disabled={saving}
                            className="h-8 rounded-md border border-[#c6d5e6] px-2 text-xs text-foreground"
                          />
                        </label>
                      </div>
                      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_4.75rem] lg:gap-4">
                        <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                          User limit mode
                          <select
                            value={licenseDraft.userLimitType}
                            onChange={(event) =>
                              setLicenseDraft((current) => ({
                                ...current,
                                userLimitType: event.target
                                  .value as "UNLIMITED" | "MAX_USERS" | "MAX_CONCURRENT_USERS",
                                userLimitValue:
                                  event.target.value === "UNLIMITED"
                                    ? ""
                                    : current.userLimitValue,
                              }))
                            }
                            disabled={saving}
                            className="h-8 w-full min-w-0 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                          >
                            <option value="UNLIMITED">Unlimited users</option>
                            <option value="MAX_USERS">Max users per business</option>
                            <option value="MAX_CONCURRENT_USERS">
                              Max concurrent users
                            </option>
                          </select>
                        </label>
                        {licenseDraft.userLimitType !== "UNLIMITED" ? (
                          <label className="grid min-w-0 gap-1 text-[11px] text-muted-foreground lg:text-[10px]">
                            User limit
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={3}
                              value={licenseDraft.userLimitValue}
                              onChange={(event) =>
                                setLicenseDraft((current) => ({
                                  ...current,
                                  userLimitValue: event.target.value.replace(/\D/g, "").slice(0, 3),
                                }))
                              }
                              disabled={saving}
                              className="h-8 w-full min-w-0 rounded-md border border-[#c6d5e6] px-2 text-xs text-foreground"
                            />
                          </label>
                        ) : (
                          <div />
                        )}
                      </div>
                      <div className="hidden gap-1 text-[11px] text-muted-foreground lg:grid">
                        Bundle
                        <select
                          value={licenseDraft.bundleKey}
                          onChange={(event) =>
                            setLicenseDraft((current) => ({
                              ...current,
                              bundleKey: event.target.value as BundleKey,
                            }))
                          }
                          disabled={saving}
                          className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                        >
                          {BUNDLE_KEYS.map((bundleKey) => (
                            <option key={bundleKey} value={bundleKey}>
                              {bundleKey}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid content-start gap-1.5">
                      <div className="grid gap-1 text-[11px] text-muted-foreground lg:hidden">
                        Bundle
                        <select
                          value={licenseDraft.bundleKey}
                          onChange={(event) =>
                            setLicenseDraft((current) => ({
                              ...current,
                              bundleKey: event.target.value as BundleKey,
                            }))
                          }
                          disabled={saving}
                          className="h-8 rounded-md border border-[#c6d5e6] bg-white px-2 text-xs text-foreground"
                        >
                          {BUNDLE_KEYS.map((bundleKey) => (
                            <option key={bundleKey} value={bundleKey}>
                              {bundleKey}
                            </option>
                          ))}
                        </select>
                      </div>

                      <LicenseCapabilityPicklist
                        capabilities={CAPABILITY_KEYS}
                        bundleCapabilities={BUNDLE_CAPABILITY_MAP[licenseDraft.bundleKey] ?? []}
                        addOnCapabilities={licenseDraft.addOnCapabilities}
                        removedCapabilities={licenseDraft.removedCapabilities}
                        disabled={saving}
                        onAddOnCapabilitiesChange={(next) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            addOnCapabilities: next as CapabilityKey[],
                            removedCapabilities: current.removedCapabilities.filter(
                              (capability) => !next.includes(capability),
                            ),
                          }))
                        }
                        onRemovedCapabilitiesChange={(next) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            removedCapabilities: next as CapabilityKey[],
                            addOnCapabilities: current.addOnCapabilities.filter(
                              (capability) => !next.includes(capability),
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={onSaveLicense}
                    disabled={saving}
                    className="w-full gap-1 text-[11px]"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save License
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-40" aria-hidden="true" />
          )}
          <LoadingOverlay
            visible={showOverlayLoader}
            label="Loading business details"
          />
        </CardContent>
      </Card>
    </section>
  );
}
