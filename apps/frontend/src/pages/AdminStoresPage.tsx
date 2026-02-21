import { useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createAdminStore,
  listAdminStores,
  type AdminStore,
} from "../features/admin/stores";
import { useAdminStoresStore } from "../features/admin/admin-stores-store";
import { IconButton } from "../design-system/atoms/IconButton";
import { StoreManagementPanel } from "../design-system/organisms/StoreManagementPanel";

type AdminStoresPageProps = {
  mode: "list" | "new";
};

export function AdminStoresPage({ mode }: AdminStoresPageProps) {
  const navigate = useNavigate();
  const stores = useAdminStoresStore((state) => state.stores);
  const page = useAdminStoresStore((state) => state.page);
  const pagination = useAdminStoresStore((state) => state.pagination);
  const filterStoreName = useAdminStoresStore((state) => state.filterStoreName);
  const filterOwnerPhone = useAdminStoresStore((state) => state.filterOwnerPhone);
  const filterIncludeDeleted = useAdminStoresStore(
    (state) => state.filterIncludeDeleted,
  );
  const error = useAdminStoresStore((state) => state.error);
  const newStoreName = useAdminStoresStore((state) => state.newStoreName);
  const newOwnerPhone = useAdminStoresStore((state) => state.newOwnerPhone);
  const setStoresPage = useAdminStoresStore((state) => state.setStoresPage);
  const setFilterStoreName = useAdminStoresStore((state) => state.setFilterStoreName);
  const setFilterOwnerPhone = useAdminStoresStore((state) => state.setFilterOwnerPhone);
  const setFilterIncludeDeleted = useAdminStoresStore(
    (state) => state.setFilterIncludeDeleted,
  );
  const clearFilters = useAdminStoresStore((state) => state.clearFilters);
  const setError = useAdminStoresStore((state) => state.setError);
  const setNewStoreName = useAdminStoresStore((state) => state.setNewStoreName);
  const setNewOwnerPhone = useAdminStoresStore((state) => state.setNewOwnerPhone);
  const clearCreateDraft = useAdminStoresStore((state) => state.clearCreateDraft);
  const [loading, setLoading] = useState(false);
  const filterReadyRef = useRef(false);

  const loadAdminStores = async (
    targetPage = page,
    filters: {
      storeName: string;
      ownerPhone: string;
      includeDeleted: boolean;
    } = {
      storeName: filterStoreName,
      ownerPhone: filterOwnerPhone,
      includeDeleted: filterIncludeDeleted,
    },
  ) => {
    const result = await listAdminStores({
      storeName: filters.storeName,
      ownerPhone: filters.ownerPhone,
      includeDeleted: filters.includeDeleted,
      page: targetPage,
      limit: 10,
    });
    setStoresPage({ stores: result.stores, pagination: result.pagination });
  };

  useEffect(() => {
    if (mode !== "list") return;

    if (stores.length === 0) {
      setLoading(true);
      setError(null);
      void loadAdminStores(1)
        .catch((requestError) => {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load stores",
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
        storeName: filterStoreName,
        ownerPhone: filterOwnerPhone,
        includeDeleted: filterIncludeDeleted,
      })
        .catch((requestError) => {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load stores",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [mode, filterStoreName, filterOwnerPhone, filterIncludeDeleted]);

  const onCreate = async () => {
    if (!newStoreName.trim() || !newOwnerPhone.trim()) {
      setError("Store name and owner phone is required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createAdminStore(newStoreName.trim(), {
        ...(newOwnerPhone.trim() ? { ownerPhone: newOwnerPhone.trim() } : {}),
      });
      clearCreateDraft();
      await loadAdminStores(1);
      navigate("/app/stores", { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create store",
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
          : "Unable to load stores",
      );
    } finally {
      setLoading(false);
    }
  };

  const onClearFilters = () => {
    const cleared = {
      storeName: "",
      ownerPhone: "",
      includeDeleted: false,
    };
    clearFilters();
    void loadAdminStores(1, cleared);
  };

  const onOpenStore = (store: AdminStore) => {
    navigate(`/app/stores/${store.id}`);
  };

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      {mode === "new" ? (
        <IconButton
          icon={ArrowLeft}
          type="button"
          variant="outline"
          onClick={() => navigate("/app/stores")}
          className="absolute right-[5.25rem] top-10 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/75 text-foreground shadow-sm backdrop-blur hover:bg-white md:right-[6.25rem] md:top-14"
          aria-label="Back to stores list"
          title="Back"
        />
      ) : null}
      <IconButton
        icon={X}
        type="button"
        variant="outline"
        onClick={() => navigate("/app")}
        className="absolute right-10 top-10 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/75 text-foreground shadow-sm backdrop-blur hover:bg-white md:right-14 md:top-14"
        aria-label="Close manage stores"
        title="Close"
      />
      <StoreManagementPanel
        mode={mode}
        stores={stores}
        page={page}
        pagination={pagination}
        filterStoreName={filterStoreName}
        filterOwnerPhone={filterOwnerPhone}
        filterIncludeDeleted={filterIncludeDeleted}
        loading={loading}
        error={error}
        newStoreName={newStoreName}
        newOwnerPhone={newOwnerPhone}
        onFilterStoreNameChange={setFilterStoreName}
        onFilterOwnerPhoneChange={setFilterOwnerPhone}
        onFilterIncludeDeletedChange={setFilterIncludeDeleted}
        onClearFilters={onClearFilters}
        onPrevPage={() => void loadAdminStores(Math.max(1, page - 1))}
        onNextPage={() => void loadAdminStores(page + 1)}
        onNewStoreNameChange={setNewStoreName}
        onNewOwnerPhoneChange={setNewOwnerPhone}
        onCreate={() => void onCreate()}
        onOpenStore={onOpenStore}
        onReload={() => void onReload()}
        onOpenCreate={() => navigate("/app/stores/new")}
        onBackToList={() => navigate("/app/stores")}
      />
    </main>
  );
}
