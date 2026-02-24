import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAdminStore,
  listAdminStores,
  type AdminStore,
} from "../features/admin/businesses";
import { useAdminBusinessesStore } from "../features/admin/admin-businesses-store";
import { BusinessManagementPanel } from "../design-system/organisms/BusinessManagementPanel";

type AdminBusinessesPageProps = {
  mode: "list" | "new";
};

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
  const clearCreateDraft = useAdminBusinessesStore((state) => state.clearCreateDraft);
  const [loading, setLoading] = useState(false);
  const filterReadyRef = useRef(false);

  const loadAdminStores = async (
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
    setBusinessesPage({ businesses: result.businesses, pagination: result.pagination });
  };

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
  }, [mode]);

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
  }, [mode, filterBusinessName, filterOwnerPhone, filterIncludeDeleted]);

  const onCreate = async () => {
    if (!newBusinessName.trim() || !newOwnerPhone.trim()) {
      setError("Business name and owner phone is required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createAdminStore(newBusinessName.trim(), {
        ...(newOwnerPhone.trim() ? { ownerPhone: newOwnerPhone.trim() } : {}),
      });
      clearCreateDraft();
      await loadAdminStores(1);
      navigate("/app/businesses", { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create business",
      );
    } finally {
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

  return (
    <section className="space-y-2">
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
        onFilterBusinessNameChange={setFilterBusinessName}
        onFilterOwnerPhoneChange={setFilterOwnerPhone}
        onFilterIncludeDeletedChange={setFilterIncludeDeleted}
        onClearFilters={onClearFilters}
        onPrevPage={() => void loadAdminStores(Math.max(1, page - 1))}
        onNextPage={() => void loadAdminStores(page + 1)}
        onNewBusinessNameChange={setNewBusinessName}
        onNewOwnerPhoneChange={setNewOwnerPhone}
        onCreate={() => void onCreate()}
        onOpenStore={onOpenStore}
        onReload={() => void onReload()}
        onOpenCreate={() => navigate("/app/businesses/new")}
        onBackToList={() => navigate("/app/businesses")}
      />
    </section>
  );
}
