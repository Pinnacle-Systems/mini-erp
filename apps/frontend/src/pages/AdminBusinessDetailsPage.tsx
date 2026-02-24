import { ImagePlus, Pencil, Save, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import imageCompression from "browser-image-compression";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "../design-system/atoms/Button";
import { IconButton } from "../design-system/atoms/IconButton";
import { Label } from "../design-system/atoms/Label";
import { LoadingOverlay } from "../design-system/atoms/LoadingOverlay";
import {
  Card,
  CardContent,
} from "../design-system/molecules/Card";
import { BusinessDetailsFormPanes } from "../design-system/organisms/BusinessDetailsFormPanes";
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
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("logo.jpg");
  const [pendingMimeType, setPendingMimeType] = useState<string>("image/jpeg");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    return () => {
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl]);

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

  const handleLogoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }

    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(URL.createObjectURL(file));
    setPendingFileName(file.name);
    setPendingMimeType(file.type || "image/jpeg");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsCropOpen(true);
    event.target.value = "";
  };

  const closeCropper = () => {
    setIsCropOpen(false);
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(null);
    setCroppedAreaPixels(null);
  };

  const getCroppedFile = async () => {
    if (!cropSourceUrl || !croppedAreaPixels) {
      return null;
    }

    const image = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to load selected image"));
    });
    image.src = cropSourceUrl;
    await imageLoaded;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to process selected image");
    }

    const { x, y, width, height } = croppedAreaPixels;
    context.drawImage(image, x, y, width, height, 0, 0, 512, 512);

    const outputType =
      pendingMimeType === "image/png" || pendingMimeType === "image/webp"
        ? pendingMimeType
        : "image/jpeg";
    const extension =
      outputType === "image/png"
        ? "png"
        : outputType === "image/webp"
          ? "webp"
          : "jpg";
    const outputName = pendingFileName.replace(/\.[^.]+$/, "") || "logo";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        resolve,
        outputType,
        outputType === "image/jpeg" ? 0.9 : undefined,
      ),
    );
    if (!blob) {
      throw new Error("Unable to process selected image");
    }
    const croppedFile = new File([blob], `${outputName}.${extension}`, {
      type: outputType,
    });
    return imageCompression(croppedFile, {
      maxSizeMB: 1.8,
      maxWidthOrHeight: 512,
      useWebWorker: true,
      fileType: outputType,
      initialQuality: outputType === "image/jpeg" ? 0.9 : undefined,
    });
  };

  const onApplyCrop = async () => {
    try {
      const croppedFile = await getCroppedFile();
      if (!croppedFile) {
        closeCropper();
        return;
      }
      await onLogoFileChange(croppedFile);
    } finally {
      closeCropper();
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
          {isCropOpen && cropSourceUrl ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                <p className="text-sm font-semibold text-slate-800">
                  Adjust logo crop
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Position and zoom to fit the avatar circle.
                </p>
                <div className="relative mt-3 h-72 overflow-hidden rounded-xl bg-slate-900">
                  <Cropper
                    image={cropSourceUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                  />
                </div>
                <div className="mt-3">
                  <Label
                    htmlFor="logo-zoom-details"
                    className="text-xs text-muted-foreground"
                  >
                    Zoom
                  </Label>
                  <input
                    id="logo-zoom-details"
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                    className="mt-1 w-full accent-[#2f6fb7]"
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCropper}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void onApplyCrop()}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {!business && !loading ? (
            <p className="text-sm text-muted-foreground">Business not found.</p>
          ) : business ? (
            <div className="grid gap-2 lg:h-full lg:min-h-0 xl:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 p-2 lg:flex-nowrap">
                  <div className="relative h-20 w-20 shrink-0">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300/90 bg-slate-50 ring-1 ring-slate-200/80">
                      {business.logo ? (
                        <img
                          src={business.logo}
                          alt="Business logo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-500">
                          <User className="h-5 w-5" aria-hidden="true" />
                          <span className="text-[10px] leading-none">
                            No logo
                          </span>
                        </div>
                      )}
                    </div>
                    <IconButton
                      icon={ImagePlus}
                      type="button"
                      variant="outline"
                      disabled={saving || uploadingLogo || removingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -left-2 h-7 w-7 rounded-full border border-[#c6d8ef] bg-[#f4f8ff] p-0 text-[#1f4167] shadow-sm hover:bg-[#eaf2ff]"
                      aria-label={
                        uploadingLogo ? "Uploading logo" : "Upload logo"
                      }
                      title={uploadingLogo ? "Uploading..." : "Upload logo"}
                    />
                    {business.logo ? (
                      <IconButton
                        icon={Trash2}
                        type="button"
                        variant="outline"
                        disabled={saving || uploadingLogo || removingLogo}
                        onClick={() => {
                          void onRemoveLogo();
                        }}
                        className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full border border-red-200 bg-red-50 p-0 text-red-700 shadow-sm hover:bg-red-100"
                        aria-label={
                          removingLogo ? "Removing logo" : "Remove logo"
                        }
                        title={removingLogo ? "Removing..." : "Remove logo"}
                      />
                    ) : null}
                  </div>
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoInputChange}
                  />
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
