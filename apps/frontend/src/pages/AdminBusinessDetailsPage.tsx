import { ImagePlus, Pencil, Save, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { Label } from "../design-system/atoms/Label";
import { LoadingOverlay } from "../design-system/atoms/LoadingOverlay";
import {
  Card,
  CardContent,
} from "../design-system/molecules/Card";
import { BusinessDetailsFormPanes } from "../design-system/organisms/BusinessDetailsFormPanes";
import { BusinessLogoPicker } from "../design-system/organisms/BusinessLogoPicker";
import {
  deleteAdminStore,
  getAdminStore,
  removeBusinessLogo,
  updateAdminStore,
  uploadBusinessLogo,
  type AdminStore,
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

  const loadStore = async () => {
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
  };

  useEffect(() => {
    void loadStore();
  }, [businessId]);

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
    <section className="h-auto lg:h-full lg:min-h-0">
      <Card className="h-auto p-3 lg:h-full lg:min-h-0 lg:p-3">
        <CardContent className="relative h-auto space-y-2 lg:h-full lg:min-h-0">
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
