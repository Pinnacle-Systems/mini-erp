import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAdminStore,
  listAdminStores,
  uploadBusinessLogo,
  type AdminStore,
} from "../features/admin/businesses";
import { useAdminBusinessesStore } from "../features/admin/admin-businesses-store";
import { BusinessManagementPanel } from "../design-system/organisms/BusinessManagementPanel";

type AdminBusinessesPageProps = {
  mode: "list" | "new";
};

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function AdminBusinessesPage({ mode }: AdminBusinessesPageProps) {
  const navigate = useNavigate();
  const businesses = useAdminBusinessesStore((state) => state.businesses);
  const page = useAdminBusinessesStore((state) => state.page);
  const pagination = useAdminBusinessesStore((state) => state.pagination);
  const filterBusinessName = useAdminBusinessesStore((state) => state.filterBusinessName);
  const filterOwnerPhone = useAdminBusinessesStore((state) => state.filterOwnerPhone);
  const filterIncludeDeleted = useAdminBusinessesStore(
    (state) => state.filterIncludeDeleted,
  );
  const error = useAdminBusinessesStore((state) => state.error);
  const newBusinessName = useAdminBusinessesStore((state) => state.newBusinessName);
  const newOwnerPhone = useAdminBusinessesStore((state) => state.newOwnerPhone);
  const newPhoneNumber = useAdminBusinessesStore((state) => state.newPhoneNumber);
  const newGstin = useAdminBusinessesStore((state) => state.newGstin);
  const newEmail = useAdminBusinessesStore((state) => state.newEmail);
  const newBusinessType = useAdminBusinessesStore((state) => state.newBusinessType);
  const newBusinessCategory = useAdminBusinessesStore((state) => state.newBusinessCategory);
  const newState = useAdminBusinessesStore((state) => state.newState);
  const newPincode = useAdminBusinessesStore((state) => state.newPincode);
  const newAddress = useAdminBusinessesStore((state) => state.newAddress);
  const setBusinessesPage = useAdminBusinessesStore((state) => state.setBusinessesPage);
  const setFilterBusinessName = useAdminBusinessesStore((state) => state.setFilterBusinessName);
  const setFilterOwnerPhone = useAdminBusinessesStore((state) => state.setFilterOwnerPhone);
  const setFilterIncludeDeleted = useAdminBusinessesStore(
    (state) => state.setFilterIncludeDeleted,
  );
  const clearFilters = useAdminBusinessesStore((state) => state.clearFilters);
  const setError = useAdminBusinessesStore((state) => state.setError);
  const setNewBusinessName = useAdminBusinessesStore((state) => state.setNewBusinessName);
  const setNewOwnerPhone = useAdminBusinessesStore((state) => state.setNewOwnerPhone);
  const setNewPhoneNumber = useAdminBusinessesStore((state) => state.setNewPhoneNumber);
  const setNewGstin = useAdminBusinessesStore((state) => state.setNewGstin);
  const setNewEmail = useAdminBusinessesStore((state) => state.setNewEmail);
  const setNewBusinessType = useAdminBusinessesStore((state) => state.setNewBusinessType);
  const setNewBusinessCategory = useAdminBusinessesStore((state) => state.setNewBusinessCategory);
  const setNewState = useAdminBusinessesStore((state) => state.setNewState);
  const setNewPincode = useAdminBusinessesStore((state) => state.setNewPincode);
  const setNewAddress = useAdminBusinessesStore((state) => state.setNewAddress);
  const clearCreateDraft = useAdminBusinessesStore((state) => state.clearCreateDraft);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const filterReadyRef = useRef(false);

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

  const validateLogoFile = (file: File | null): string | null => {
    if (!file) return null;
    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      return "Logo must be PNG, JPG, or WEBP.";
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      return "Logo file is too large. Maximum allowed size is 2MB.";
    }
    return null;
  };

  const loadAdminStores = useCallback(
    async (
      targetPage = page,
      filters: {
        businessName: string;
        ownerPhone: string;
        includeDeleted: boolean;
      } = {
        businessName: filterBusinessName,
        ownerPhone: filterOwnerPhone,
        includeDeleted: filterIncludeDeleted,
      },
    ) => {
      const result = await listAdminStores({
        businessName: filters.businessName,
        ownerPhone: filters.ownerPhone,
        includeDeleted: filters.includeDeleted,
        page: targetPage,
        limit: 10,
      });
      setBusinessesPage({
        businesses: result.businesses,
        pagination: result.pagination,
      });
    },
    [filterBusinessName, filterIncludeDeleted, filterOwnerPhone, page, setBusinessesPage],
  );

  useEffect(() => {
    if (mode !== "list") return;

    if (businesses.length === 0) {
      setLoading(true);
      setError(null);
      void loadAdminStores(1)
        .catch((requestError) => {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load businesses",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [businesses.length, loadAdminStores, mode, setError]);

  useEffect(() => {
    if (mode !== "list") {
      filterReadyRef.current = false;
      return;
    }

    if (!filterReadyRef.current) {
      filterReadyRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void loadAdminStores(1, {
        businessName: filterBusinessName,
        ownerPhone: filterOwnerPhone,
        includeDeleted: filterIncludeDeleted,
      })
        .catch((requestError) => {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load businesses",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [
    filterBusinessName,
    filterIncludeDeleted,
    filterOwnerPhone,
    loadAdminStores,
    mode,
    setError,
  ]);

  const onCreate = async () => {
    if (!newBusinessName.trim() || !newOwnerPhone.trim()) {
      setError("Business name and owner phone is required.");
      return;
    }
    const logoValidationError = validateLogoFile(logoFile);
    if (logoValidationError) {
      setError(logoValidationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let logoUploadWarning: string | null = null;
      const created = await createAdminStore(newBusinessName.trim(), {
        ...(newOwnerPhone.trim() ? { ownerPhone: newOwnerPhone.trim() } : {}),
        ...(newPhoneNumber.trim() ? { phoneNumber: newPhoneNumber.trim() } : {}),
        ...(newGstin.trim() ? { gstin: newGstin.trim() } : {}),
        ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
        ...(newBusinessType.trim() ? { businessType: newBusinessType.trim() } : {}),
        ...(newBusinessCategory.trim() ? { businessCategory: newBusinessCategory.trim() } : {}),
        ...(newState.trim() ? { state: newState.trim() } : {}),
        ...(newPincode.trim() ? { pincode: newPincode.trim() } : {}),
        ...(newAddress.trim() ? { address: newAddress.trim() } : {}),
      });

      if (logoFile) {
        setUploadingLogo(true);
        try {
          const dataBase64 = await fileToBase64(logoFile);
          await uploadBusinessLogo(created.id, {
            fileName: logoFile.name,
            mimeType: logoFile.type,
            dataBase64,
          });
        } catch (logoUploadError) {
          const logoMessage =
            logoUploadError instanceof Error
              ? logoUploadError.message
              : "Unable to upload logo";
          logoUploadWarning = logoMessage;
        } finally {
          setUploadingLogo(false);
        }
      }

      clearCreateDraft();
      setLogoFile(null);
      setLogoPreviewUrl(null);
      await loadAdminStores(1);
      if (logoUploadWarning) {
        setError(
          `Business created successfully, but logo was not set: ${logoUploadWarning}. You can upload it later from business details.`,
        );
      }
      navigate(`/app/businesses/${created.id}`, { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create business",
      );
    } finally {
      setUploadingLogo(false);
      setLoading(false);
    }
  };

  const onReload = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadAdminStores(page);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load businesses",
      );
    } finally {
      setLoading(false);
    }
  };

  const onClearFilters = () => {
    const cleared = {
      businessName: "",
      ownerPhone: "",
      includeDeleted: false,
    };
    clearFilters();
    void loadAdminStores(1, cleared);
  };

  const onOpenStore = (business: AdminStore) => {
    navigate(`/app/businesses/${business.id}`);
  };

  const onLogoFileChange = (file: File | null) => {
    const logoValidationError = validateLogoFile(file);
    if (logoValidationError) {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      setLogoFile(null);
      setLogoPreviewUrl(null);
      setError(logoValidationError);
      return;
    }

    setError(null);
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoFile(file);
    setLogoPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  return (
    <section className="h-auto space-y-2 lg:h-full lg:min-h-0">
      <BusinessManagementPanel
        mode={mode}
        businesses={businesses}
        page={page}
        pagination={pagination}
        filterBusinessName={filterBusinessName}
        filterOwnerPhone={filterOwnerPhone}
        filterIncludeDeleted={filterIncludeDeleted}
        loading={loading}
        error={error}
        newBusinessName={newBusinessName}
        newOwnerPhone={newOwnerPhone}
        newPhoneNumber={newPhoneNumber}
        newGstin={newGstin}
        newEmail={newEmail}
        newBusinessType={newBusinessType}
        newBusinessCategory={newBusinessCategory}
        newState={newState}
        newPincode={newPincode}
        newAddress={newAddress}
        logoPreviewUrl={logoPreviewUrl}
        uploadingLogo={uploadingLogo}
        onFilterBusinessNameChange={setFilterBusinessName}
        onFilterOwnerPhoneChange={setFilterOwnerPhone}
        onFilterIncludeDeletedChange={setFilterIncludeDeleted}
        onClearFilters={onClearFilters}
        onPrevPage={() => void loadAdminStores(Math.max(1, page - 1))}
        onNextPage={() => void loadAdminStores(page + 1)}
        onNewBusinessNameChange={setNewBusinessName}
        onNewOwnerPhoneChange={setNewOwnerPhone}
        onNewPhoneNumberChange={setNewPhoneNumber}
        onNewGstinChange={setNewGstin}
        onNewEmailChange={setNewEmail}
        onNewBusinessTypeChange={setNewBusinessType}
        onNewBusinessCategoryChange={setNewBusinessCategory}
        onNewStateChange={setNewState}
        onNewPincodeChange={setNewPincode}
        onNewAddressChange={setNewAddress}
        onLogoFileChange={onLogoFileChange}
        onCreate={() => void onCreate()}
        onOpenStore={onOpenStore}
        onReload={() => void onReload()}
        onBackToList={() => navigate("/app/businesses")}
      />
    </section>
  );
}
