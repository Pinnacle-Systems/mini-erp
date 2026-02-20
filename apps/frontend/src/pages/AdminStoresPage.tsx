import { ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AdminStore, AdminStoresPagination } from "../features/admin/stores";
import { IconButton } from "../design-system/atoms/IconButton";
import { StoreManagementPanel } from "../design-system/organisms/StoreManagementPanel";

type AdminStoresPageProps = {
  mode: "list" | "new";
  stores: AdminStore[];
  page: number;
  pagination: AdminStoresPagination;
  filterStoreName: string;
  filterOwnerPhone: string;
  loading: boolean;
  error: string | null;
  newStoreName: string;
  newOwnerPhone: string;
  editStoreId: string | null;
  editStoreName: string;
  editOwnerId: string;
  onFilterStoreNameChange: (value: string) => void;
  onFilterOwnerPhoneChange: (value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onNewStoreNameChange: (value: string) => void;
  onNewOwnerPhoneChange: (value: string) => void;
  onCreate: () => void;
  onStartEdit: (store: AdminStore) => void;
  onCancelEdit: () => void;
  onEditStoreNameChange: (value: string) => void;
  onEditOwnerIdChange: (value: string) => void;
  onSaveEdit: () => void;
  onDelete: (storeId: string) => void;
  onReload: () => void;
};

export function AdminStoresPage(props: AdminStoresPageProps) {
  const navigate = useNavigate();
  const { mode, ...panelProps } = props;

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
        {...panelProps}
        mode={mode}
        onOpenCreate={() => navigate("/app/stores/new")}
        onBackToList={() => navigate("/app/stores")}
      />
    </main>
  );
}
