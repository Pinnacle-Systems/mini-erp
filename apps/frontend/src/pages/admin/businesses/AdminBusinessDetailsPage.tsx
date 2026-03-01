import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Label } from "../../../design-system/atoms/Label";
import { LoadingOverlay } from "../../../design-system/atoms/LoadingOverlay";
import { Switch } from "../../../design-system/atoms/Switch";
import {
  Card,
  CardContent,
} from "../../../design-system/molecules/Card";
import { PageActionBar } from "../../../design-system/molecules/PageActionBar";
import { BusinessDetailsFormPanes } from "../../../design-system/organisms/BusinessDetailsFormPanes";
import { BusinessLicensePane } from "../../../design-system/organisms/BusinessLicensePane";
import { BusinessLogoPicker } from "../../../design-system/organisms/BusinessLogoPicker";
import {
  deleteAdminStore,
  getAdminStore,
  removeBusinessLogo,
  updateAdminStore,
  uploadBusinessLogo,
  type AdminStore,
  type BundleKey,
  type CapabilityKey,
} from "../../../features/admin/businesses";

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

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
  const [logoDraftFile, setLogoDraftFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoMarkedForRemoval, setLogoMarkedForRemoval] = useState(false);
  const showOverlayLoader = loading || saving;

  const clearLogoDraft = () => {
    setLogoDraftFile(null);
    setLogoMarkedForRemoval(false);
    setLogoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  };

  useEffect(
    () => () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    },
    [logoPreviewUrl],
  );

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
      applyLicenseDraft(result);
      clearLogoDraft();
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
        "Mark this business as inactive? You can reactivate it later.",
      );
      if (!confirmed) return;
      await onDelete();
      return;
    }

    await onRestore();
  };

  const buildLicenseUpdatePayload = () => {
    if (!licenseDraft.beginsOn || !licenseDraft.endsOn) {
      setError("License begin and end dates are required.");
      return null;
    }
    if (licenseDraft.userLimitType !== "UNLIMITED") {
      const parsedLimit = Number(licenseDraft.userLimitValue);
      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 999) {
        setError("User limit must be a positive whole number up to 999.");
        return null;
      }
    }

    const addOn = Array.from(new Set(licenseDraft.addOnCapabilities));
    const removed = Array.from(
      new Set(licenseDraft.removedCapabilities.filter((capability) => !addOn.includes(capability))),
    );

    return {
      beginsOn: licenseDraft.beginsOn,
      endsOn: licenseDraft.endsOn,
      bundleKey: licenseDraft.bundleKey,
      addOnCapabilities: addOn,
      removedCapabilities: removed,
      userLimitType:
        licenseDraft.userLimitType === "UNLIMITED" ? null : licenseDraft.userLimitType,
      userLimitValue:
        licenseDraft.userLimitType === "UNLIMITED"
          ? null
          : Number(licenseDraft.userLimitValue),
    };
  };

  const onSaveDetails = async () => {
    if (!businessId) return;
    if (!isEditingDetails) return;
    if (!nameDraft.trim()) {
      setError("Business name is required.");
      return;
    }
    const licensePayload = buildLicenseUpdatePayload();
    if (!licensePayload) return;

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
        license: licensePayload,
      });

      if (logoDraftFile) {
        const dataBase64 = await fileToBase64(logoDraftFile);
        await uploadBusinessLogo(businessId, {
          fileName: logoDraftFile.name,
          mimeType: logoDraftFile.type,
          dataBase64,
        });
      } else if (logoMarkedForRemoval) {
        await removeBusinessLogo(businessId);
      }
    });
    clearLogoDraft();
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

  const validateLogoFile = (file: File): string | null => {
    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      return "Logo must be PNG, JPG, or WEBP.";
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      return "Logo file is too large. Maximum allowed size is 2MB.";
    }
    return null;
  };

  const onLogoFileChange = (file: File) => {
    if (!isEditingDetails || saving) {
      return;
    }

    const logoValidationError = validateLogoFile(file);
    if (logoValidationError) {
      setError(logoValidationError);
      return;
    }

    setError(null);
    setLogoMarkedForRemoval(false);
    setLogoDraftFile(file);
    setLogoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
  };

  const onRemoveLogo = () => {
    if (!isEditingDetails || saving) {
      return;
    }

    setError(null);
    setLogoDraftFile(null);
    setLogoMarkedForRemoval(true);
    setLogoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  };

  const ownerDisplayValue =
    business?.owner?.name?.trim() || business?.owner?.phone || "";
  const isFormLocked = !isEditingDetails;
  const displayLogoUrl =
    logoPreviewUrl ?? (logoMarkedForRemoval ? null : (business?.logo || null));

  return (
    <section className="h-auto lg:h-full lg:min-h-0 lg:text-[12px]">
      <Card className="h-auto p-2 lg:h-full lg:min-h-0 lg:p-2">
        <CardContent className="relative h-auto space-y-2 lg:h-full lg:min-h-0 lg:[&_button]:text-[11px] lg:[&_input]:text-[11px] lg:[&_label]:text-[10px] lg:[&_p]:text-[11px] lg:[&_select]:text-[11px] lg:[&_span]:text-[11px]">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {!business && !loading ? (
            <p className="text-sm text-muted-foreground">Business not found.</p>
          ) : business ? (
            <div className="space-y-2 pb-20 sm:pb-24 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:pb-0">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-white p-2 lg:shrink-0">
                <BusinessLogoPicker
                  logoUrl={displayLogoUrl}
                  disabled={saving || isFormLocked}
                  removing={false}
                  showActions={isEditingDetails}
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
                <div className="ml-auto flex w-full flex-wrap items-center gap-1.5 lg:w-auto">
                  {!isEditingDetails ? (
                    <PageActionBar
                      primaryLabel="Edit Details"
                      onPrimaryClick={() => {
                        setError(null);
                        setIsEditingDetails(true);
                      }}
                      primaryDisabled={saving}
                    />
                  ) : (
                    <PageActionBar
                      primaryLabel="Save Changes"
                      onPrimaryClick={onSaveDetails}
                      primaryDisabled={saving}
                      primaryLoading={saving}
                      primaryLoadingLabel="Saving..."
                      secondaryLabel="Cancel"
                      secondaryDisabled={saving}
                      onSecondaryClick={() => {
                        applyDetailsDraft(business);
                        applyLicenseDraft(business);
                        clearLogoDraft();
                        setIsEditingDetails(false);
                      }}
                    />
                  )}
                  <div className="ml-auto flex items-center gap-1.5 lg:ml-1">
                    <Label htmlFor="business-active-status" className="text-[11px] font-medium text-muted-foreground">
                      {business.deletedAt ? "Inactive" : "Active"}
                    </Label>
                    <Switch
                      id="business-active-status"
                      aria-label="Toggle business active state"
                      checked={!business.deletedAt}
                      onCheckedChange={() => {
                        void onToggleBusinessStatus(Boolean(business.deletedAt));
                      }}
                      disabled={saving}
                      className="h-6 w-11 border"
                      checkedTrackClassName="border-[#2f6fb7] bg-[#4a8dd9]"
                      uncheckedTrackClassName="border-[#b8cbe0] bg-[#e7eff8]"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
                <div className="lg:min-h-0 lg:flex-1">
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
                    rightColumnExtra={
                      <BusinessLicensePane
                        beginsOn={licenseDraft.beginsOn}
                        endsOn={licenseDraft.endsOn}
                        bundleKey={licenseDraft.bundleKey}
                        addOnCapabilities={licenseDraft.addOnCapabilities}
                        removedCapabilities={licenseDraft.removedCapabilities}
                        userLimitType={licenseDraft.userLimitType}
                        userLimitValue={licenseDraft.userLimitValue}
                        disabled={saving || isFormLocked}
                        onBeginsOnChange={(value) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            beginsOn: value,
                          }))
                        }
                        onEndsOnChange={(value) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            endsOn: value,
                          }))
                        }
                        onBundleKeyChange={(value) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            bundleKey: value,
                          }))
                        }
                        onAddOnCapabilitiesChange={(next) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            addOnCapabilities: next,
                            removedCapabilities: current.removedCapabilities.filter(
                              (capability) => !next.includes(capability),
                            ),
                          }))
                        }
                        onRemovedCapabilitiesChange={(next) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            removedCapabilities: next,
                            addOnCapabilities: current.addOnCapabilities.filter(
                              (capability) => !next.includes(capability),
                            ),
                          }))
                        }
                        onUserLimitTypeChange={(value) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            userLimitType: value,
                            userLimitValue:
                              value === "UNLIMITED" ? "" : current.userLimitValue,
                          }))
                        }
                        onUserLimitValueChange={(value) =>
                          setLicenseDraft((current) => ({
                            ...current,
                            userLimitValue: value,
                          }))
                        }
                      />
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
