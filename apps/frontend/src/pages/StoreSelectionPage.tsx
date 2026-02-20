import type { AssignedStore } from "../features/auth/store-context";
import { StorePanel } from "../design-system/organisms/StorePanel";

type StoreSelectionPageProps = {
  stores: AssignedStore[];
  activeStore: string | null;
  activeStoreName: string;
  loading: boolean;
  isAuthenticated: boolean;
  onStoreChange: (storeId: string) => void;
  onApplyStoreToken: () => void;
};

export function StoreSelectionPage({
  stores,
  activeStore,
  activeStoreName,
  loading,
  isAuthenticated,
  onStoreChange,
  onApplyStoreToken,
}: StoreSelectionPageProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-4 p-6 md:p-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">
          Select a store
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose the store you want to access for this session.
        </p>
      </header>
      <StorePanel
        stores={stores}
        activeStore={activeStore}
        activeStoreName={activeStoreName}
        loading={loading}
        isAuthenticated={isAuthenticated}
        onStoreChange={onStoreChange}
        onApplyStoreToken={onApplyStoreToken}
      />
    </main>
  );
}
