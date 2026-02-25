import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CAPABILITY_KEYS,
  createAdminStore,
  lookupAdminOwners,
  listAdminStores,
  uploadBusinessLogo,
  type AdminStore,
  type AdminOwnerLookupResult,
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
  const newOwnerId = useAdminBusinessesStore((state) => state.newOwnerId);
  const newOwnerPhone = useAdminBusinessesStore((state) => state.newOwnerPhone);
  const newPhoneNumber = useAdminBusinessesStore((state) => state.newPhoneNumber);
  const newGstin = useAdminBusinessesStore((state) => state.newGstin);
  const newEmail = useAdminBusinessesStore((state) => state.newEmail);
  const newBusinessType = useAdminBusinessesStore((state) => state.newBusinessType);
  const newBusinessCategory = useAdminBusinessesStore((state) => state.newBusinessCategory);
  const newState = useAdminBusinessesStore((state) => state.newState);
  const newPincode = useAdminBusinessesStore((state) => state.newPincode);
  const newAddress = useAdminBusinessesStore((state) => state.newAddress);
  const newLicenseBeginsOn = useAdminBusinessesStore((state) => state.newLicenseBeginsOn);
  const newLicenseEndsOn = useAdminBusinessesStore((state) => state.newLicenseEndsOn);
  const newLicenseBundleKey = useAdminBusinessesStore((state) => state.newLicenseBundleKey);
  const newLicenseAddOnCapabilities = useAdminBusinessesStore(
    (state) => state.newLicenseAddOnCapabilities,
  );
  const newLicenseRemovedCapabilities = useAdminBusinessesStore(
    (state) => state.newLicenseRemovedCapabilities,
  );
  const newLicenseUserLimitType = useAdminBusinessesStore((state) => state.newLicenseUserLimitType);
  const newLicenseUserLimitValue = useAdminBusinessesStore((state) => state.newLicenseUserLimitValue);
  const setBusinessesPage = useAdminBusinessesStore((state) => state.setBusinessesPage);
  const setFilterBusinessName = useAdminBusinessesStore((state) => state.setFilterBusinessName);
  const setFilterOwnerPhone = useAdminBusinessesStore((state) => state.setFilterOwnerPhone);
  const setFilterIncludeDeleted = useAdminBusinessesStore(
    (state) => state.setFilterIncludeDeleted,
  );
  const clearFilters = useAdminBusinessesStore((state) => state.clearFilters);
  const setError = useAdminBusinessesStore((state) => state.setError);
  const setNewBusinessName = useAdminBusinessesStore((state) => state.setNewBusinessName);
  const setNewOwnerId = useAdminBusinessesStore((state) => state.setNewOwnerId);
  const setNewOwnerPhone = useAdminBusinessesStore((state) => state.setNewOwnerPhone);
  const setNewPhoneNumber = useAdminBusinessesStore((state) => state.setNewPhoneNumber);
  const setNewGstin = useAdminBusinessesStore((state) => state.setNewGstin);
  const setNewEmail = useAdminBusinessesStore((state) => state.setNewEmail);
  const setNewBusinessType = useAdminBusinessesStore((state) => state.setNewBusinessType);
  const setNewBusinessCategory = useAdminBusinessesStore((state) => state.setNewBusinessCategory);
  const setNewState = useAdminBusinessesStore((state) => state.setNewState);
  const setNewPincode = useAdminBusinessesStore((state) => state.setNewPincode);
  const setNewAddress = useAdminBusinessesStore((state) => state.setNewAddress);
  const setNewLicenseBeginsOn = useAdminBusinessesStore((state) => state.setNewLicenseBeginsOn);
  const setNewLicenseEndsOn = useAdminBusinessesStore((state) => state.setNewLicenseEndsOn);
  const setNewLicenseBundleKey = useAdminBusinessesStore((state) => state.setNewLicenseBundleKey);
  const setNewLicenseAddOnCapabilities = useAdminBusinessesStore(
    (state) => state.setNewLicenseAddOnCapabilities,
  );
  const setNewLicenseRemovedCapabilities = useAdminBusinessesStore(
    (state) => state.setNewLicenseRemovedCapabilities,
  );
  const setNewLicenseUserLimitType = useAdminBusinessesStore(
    (state) => state.setNewLicenseUserLimitType,
  );
  const setNewLicenseUserLimitValue = useAdminBusinessesStore(
    (state) => state.setNewLicenseUserLimitValue,
  );
  const clearCreateDraft = useAdminBusinessesStore((state) => state.clearCreateDraft);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [ownerLookupResults, setOwnerLookupResults] = useState<AdminOwnerLookupResult[]>([]);
  const [ownerLookupLoading, setOwnerLookupLoading] = useState(false);
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

  useEffect(() => {
    if (mode !== "new") {
      setOwnerLookupResults([]);
      setOwnerLookupLoading(false);
      return;
    }
    const query = newOwnerPhone.trim();
    if (query.length < 2) {
      setOwnerLookupResults([]);
      setOwnerLookupLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOwnerLookupLoading(true);
      void lookupAdminOwners(query)
        .then((owners) => {
          setOwnerLookupResults(owners);
        })
        .catch((requestError) => {
          setOwnerLookupResults([]);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load owners",
          );
        })
        .finally(() => {
          setOwnerLookupLoading(false);
        });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [mode, newOwnerPhone, setError]);

  const onCreate = async () => {
    if (!newBusinessName.trim() || !newOwnerId) {
      setError("Business name and owner selection is required.");
      return;
    }
    if (Boolean(newLicenseBeginsOn) !== Boolean(newLicenseEndsOn)) {
      setError("Provide both license begin and end dates.");
      return;
    }
    if (newLicenseUserLimitType !== "UNLIMITED") {
      const parsedLimit = Number(newLicenseUserLimitValue);
      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 999) {
        setError("License user limit must be a positive whole number up to 999.");
        return;
      }
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
      const addOnCapabilities = Array.from(
        new Set(
          newLicenseAddOnCapabilities.filter((key) =>
            CAPABILITY_KEYS.includes(key),
          ),
        ),
      );
      const removedCapabilities = Array.from(
        new Set(
          newLicenseRemovedCapabilities.filter(
            (key) => CAPABILITY_KEYS.includes(key) && !addOnCapabilities.includes(key),
          ),
        ),
      );
      const created = await createAdminStore(newBusinessName.trim(), {
        ownerId: newOwnerId,
        ...(newPhoneNumber.trim() ? { phoneNumber: newPhoneNumber.trim() } : {}),
        ...(newGstin.trim() ? { gstin: newGstin.trim() } : {}),
        ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
        ...(newBusinessType.trim() ? { businessType: newBusinessType.trim() } : {}),
        ...(newBusinessCategory.trim() ? { businessCategory: newBusinessCategory.trim() } : {}),
        ...(newState.trim() ? { state: newState.trim() } : {}),
        ...(newPincode.trim() ? { pincode: newPincode.trim() } : {}),
        ...(newAddress.trim() ? { address: newAddress.trim() } : {}),
        ...(newLicenseBeginsOn && newLicenseEndsOn
          ? {
              license: {
                beginsOn: newLicenseBeginsOn,
                endsOn: newLicenseEndsOn,
                bundleKey: newLicenseBundleKey,
                addOnCapabilities,
                removedCapabilities,
                userLimitType:
                  newLicenseUserLimitType === "UNLIMITED"
                    ? null
                    : newLicenseUserLimitType,
                userLimitValue:
                  newLicenseUserLimitType === "UNLIMITED"
                    ? null
                    : Number(newLicenseUserLimitValue),
              },
            }
          : {}),
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
      setOwnerLookupResults([]);
      await loadAdminStores(1);
      if (logoUploadWarning) {
        setError(
          `Business created successfully, but logo was not set: ${logoUploadWarning}. You can upload it later from business details.`,
        );
      }
      navigate("/app/businesses", { replace: true });
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
        newOwnerId={newOwnerId}
        newOwnerPhone={newOwnerPhone}
        ownerLookupResults={ownerLookupResults}
        ownerLookupLoading={ownerLookupLoading}
        newPhoneNumber={newPhoneNumber}
        newGstin={newGstin}
        newEmail={newEmail}
        newBusinessType={newBusinessType}
        newBusinessCategory={newBusinessCategory}
        newState={newState}
        newPincode={newPincode}
        newAddress={newAddress}
        newLicenseBeginsOn={newLicenseBeginsOn}
        newLicenseEndsOn={newLicenseEndsOn}
        newLicenseBundleKey={newLicenseBundleKey}
        newLicenseAddOnCapabilities={newLicenseAddOnCapabilities}
        newLicenseRemovedCapabilities={newLicenseRemovedCapabilities}
        newLicenseUserLimitType={newLicenseUserLimitType}
        newLicenseUserLimitValue={newLicenseUserLimitValue}
        logoPreviewUrl={logoPreviewUrl}
        uploadingLogo={uploadingLogo}
        onFilterBusinessNameChange={setFilterBusinessName}
        onFilterOwnerPhoneChange={setFilterOwnerPhone}
        onFilterIncludeDeletedChange={setFilterIncludeDeleted}
        onClearFilters={onClearFilters}
        onPrevPage={() => void loadAdminStores(Math.max(1, page - 1))}
        onNextPage={() => void loadAdminStores(page + 1)}
        onNewBusinessNameChange={setNewBusinessName}
        onOwnerLookupQueryChange={(value) => {
          setNewOwnerPhone(value);
          setNewOwnerId(null);
        }}
        onOwnerSelect={(owner) => {
          const displayValue = owner.name?.trim()
            ? `${owner.name.trim()}${owner.phone ? ` | ${owner.phone}` : ""}`
            : owner.phone || owner.email || "Unnamed owner";
          setNewOwnerPhone(displayValue);
          setNewOwnerId(owner.id);
          setOwnerLookupResults([]);
          setError(null);
        }}
        onNewOwnerPhoneChange={setNewOwnerPhone}
        onNewPhoneNumberChange={setNewPhoneNumber}
        onNewGstinChange={setNewGstin}
        onNewEmailChange={setNewEmail}
        onNewBusinessTypeChange={setNewBusinessType}
        onNewBusinessCategoryChange={setNewBusinessCategory}
        onNewStateChange={setNewState}
        onNewPincodeChange={setNewPincode}
        onNewAddressChange={setNewAddress}
        onNewLicenseBeginsOnChange={setNewLicenseBeginsOn}
        onNewLicenseEndsOnChange={setNewLicenseEndsOn}
        onNewLicenseBundleKeyChange={setNewLicenseBundleKey}
        onNewLicenseAddOnCapabilitiesChange={setNewLicenseAddOnCapabilities}
        onNewLicenseRemovedCapabilitiesChange={setNewLicenseRemovedCapabilities}
        onNewLicenseUserLimitTypeChange={setNewLicenseUserLimitType}
        onNewLicenseUserLimitValueChange={setNewLicenseUserLimitValue}
        onLogoFileChange={onLogoFileChange}
        onCreate={() => void onCreate()}
        onOpenStore={onOpenStore}
        onReload={() => void onReload()}
        onBackToList={() => navigate("/app/businesses")}
      />
    </section>
  );
}
