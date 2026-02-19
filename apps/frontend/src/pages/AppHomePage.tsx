import { AnimatePresence, motion } from "framer-motion";
import { AppFolderLauncher, type AppFolder, type FolderId } from "../design-system/organisms/AppFolderLauncher";
import { StorePanel } from "../design-system/organisms/StorePanel";
import { SyncPanel } from "../design-system/organisms/SyncPanel";
import type { AssignedStore } from "../features/auth/store-context";

type AppHomePageProps = {
  stores: AssignedStore[];
  activeStore: string | null;
  activeStoreName: string;
  loading: boolean;
  isAuthenticated: boolean;
  isStoreSelected: boolean;
  activeFolder: FolderId;
  sku: string;
  name: string;
  description: string;
  localProducts: string[];
  onSetActiveFolder: (folder: FolderId) => void;
  onStoreChange: (storeId: string) => void;
  onApplyStoreToken: () => void;
  onSkuChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onQueueProductCreate: () => void;
  onSyncNow: () => void;
};

const folders: AppFolder[] = [
  {
    id: "store",
    label: "Store",
    accent: "bg-primary/60",
    description: "Select a store and apply tenant token"
  },
  {
    id: "sync",
    label: "Sync",
    accent: "bg-secondary-foreground/60",
    description: "Queue product mutations and sync now"
  }
];

export function AppHomePage({
  stores,
  activeStore,
  activeStoreName,
  loading,
  isAuthenticated,
  isStoreSelected,
  activeFolder,
  sku,
  name,
  description,
  localProducts,
  onSetActiveFolder,
  onStoreChange,
  onApplyStoreToken,
  onSkuChange,
  onNameChange,
  onDescriptionChange,
  onQueueProductCreate,
  onSyncNow
}: AppHomePageProps) {
  const renderActiveFolderPanel = () => {
    if (activeFolder === "store") {
      return (
        <StorePanel
          stores={stores}
          activeStore={activeStore}
          activeStoreName={activeStoreName}
          loading={loading}
          isAuthenticated={isAuthenticated}
          onStoreChange={onStoreChange}
          onApplyStoreToken={onApplyStoreToken}
        />
      );
    }

    if (activeFolder === "sync") {
      return (
        <SyncPanel
          sku={sku}
          name={name}
          description={description}
          localProducts={localProducts}
          loading={loading}
          isAuthenticated={isAuthenticated}
          activeStore={activeStore}
          isStoreSelected={isStoreSelected}
          onSkuChange={onSkuChange}
          onNameChange={onNameChange}
          onDescriptionChange={onDescriptionChange}
          onQueueProductCreate={onQueueProductCreate}
          onSyncNow={onSyncNow}
        />
      );
    }
    return null;
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-8 p-6 md:p-10">
      <section className="space-y-5">
        <AppFolderLauncher folders={folders} activeFolder={activeFolder} onSelect={onSetActiveFolder} />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFolder}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {renderActiveFolderPanel()}
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}
