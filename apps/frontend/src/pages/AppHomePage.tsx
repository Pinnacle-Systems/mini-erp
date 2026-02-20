import { AnimatePresence, motion } from "framer-motion";
import {
  Boxes,
  ClipboardList,
  FileText,
  HandCoins,
  Package,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { SyncPanel } from "../design-system/organisms/SyncPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";
import { IconButton } from "../design-system/atoms/IconButton";

type AppHomePageProps = {
  activeStore: string | null;
  activeStoreName: string;
  loading: boolean;
  isAuthenticated: boolean;
  isStoreSelected: boolean;
  sku: string;
  name: string;
  description: string;
  localProducts: string[];
  onSkuChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onQueueProductCreate: () => void;
  onSyncNow: () => void;
};

type UserFolderId = "purchase" | "sales" | "inventory";
type UserAppId =
  | "purchase-bills"
  | "purchase-orders"
  | "purchase-returns"
  | "sales-bills"
  | "sales-orders"
  | "sales-returns"
  | "inventory-sync"
  | "inventory-products"
  | "inventory-adjustments";

type UserFolderApp = {
  id: UserAppId;
  label: string;
  Icon: LucideIcon;
};

const folders: Array<{
  id: UserFolderId;
  label: string;
  apps: UserFolderApp[];
}> = [
  {
    id: "purchase",
    label: "Purchase",
    apps: [
      {
        id: "purchase-bills",
        label: "Purchase Bills",
        Icon: ReceiptText,
      },
      {
        id: "purchase-orders",
        label: "Purchase Orders",
        Icon: ShoppingBag,
      },
      {
        id: "purchase-returns",
        label: "Purchase Returns",
        Icon: RotateCcw,
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    apps: [
      {
        id: "sales-bills",
        label: "Sales Bills",
        Icon: HandCoins,
      },
      {
        id: "sales-orders",
        label: "Sales Orders",
        Icon: FileText,
      },
      {
        id: "sales-returns",
        label: "Sales Returns",
        Icon: Undo2,
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    apps: [
      {
        id: "inventory-sync",
        label: "Product Sync",
        Icon: Boxes,
      },
      {
        id: "inventory-products",
        label: "Products",
        Icon: Package,
      },
      {
        id: "inventory-adjustments",
        label: "Adjustments",
        Icon: ClipboardList,
      },
    ],
  }
];

export function AppHomePage({
  activeStore,
  activeStoreName,
  loading,
  isAuthenticated,
  isStoreSelected,
  sku,
  name,
  description,
  localProducts,
  onSkuChange,
  onNameChange,
  onDescriptionChange,
  onQueueProductCreate,
  onSyncNow
}: AppHomePageProps) {
  const [openFolderId, setOpenFolderId] = useState<UserFolderId | null>(null);
  const [activeAppId, setActiveAppId] = useState<UserAppId | null>(null);

  const openFolder = useMemo(
    () => folders.find((folder) => folder.id === openFolderId) ?? null,
    [openFolderId],
  );

  const openFolderApps = useMemo(
    () => openFolder?.apps.slice(0, 9) ?? [],
    [openFolder],
  );

  const renderFolderContent = () => {
    if (!activeAppId) {
      return null;
    }

    if (activeAppId === "inventory-sync") {
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

    if (activeAppId.startsWith("purchase")) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Purchase</CardTitle>
            <CardDescription>
              <strong>{activeStoreName}</strong> purchase app:{" "}
              {openFolderApps.find((app) => app.id === activeAppId)?.label ?? "Purchase"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              App content will be added here.
            </p>
          </CardContent>
        </Card>
      );
    }

    if (activeAppId.startsWith("sales")) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Sales</CardTitle>
            <CardDescription>
              <strong>{activeStoreName}</strong> sales app:{" "}
              {openFolderApps.find((app) => app.id === activeAppId)?.label ?? "Sales"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              App content will be added here.
            </p>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 p-6 md:p-10">
      <section>
        <p className="mb-4 text-sm font-medium tracking-[0.01em] text-muted-foreground">
          Apps
        </p>
        <div className="grid grid-cols-3 gap-[clamp(0.5rem,1.4vw,1.25rem)] md:[grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
          {folders.map((folder) => (
            <div key={folder.id} className="w-full md:max-w-[14rem] md:justify-self-center">
              <motion.section
                layout
                transition={{ type: "spring", damping: 24, stiffness: 320 }}
                onClick={() => {
                  setOpenFolderId(folder.id);
                  setActiveAppId(null);
                }}
                className="aspect-square w-full cursor-pointer rounded-[clamp(0.9rem,2vw,1.75rem)] border border-white/70 bg-white/60 p-[clamp(0.35rem,1vw,0.75rem)] shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl"
              >
                <motion.div
                  layout
                  className="grid h-full w-full grid-cols-3 grid-rows-3 place-items-center gap-[clamp(0.25rem,0.8vw,0.75rem)] rounded-[clamp(0.65rem,1.7vw,1.25rem)] border border-white/75 bg-gradient-to-b from-white/85 to-white/55 p-[clamp(0.35rem,1vw,0.75rem)]"
                >
                  {folder.apps.slice(0, 9).map((app) => (
                    <span
                      key={app.id}
                      title={app.label}
                      aria-label={app.label}
                      className="flex h-full w-full items-center justify-center text-foreground/80"
                    >
                      <app.Icon className="h-[80%] w-[80%]" />
                    </span>
                  ))}
                </motion.div>
              </motion.section>
              <p className="mt-3 text-center text-[clamp(0.7rem,1.3vw,1rem)] font-medium leading-tight text-foreground/90">
                {folder.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {openFolder ? (
          <>
            <motion.div
              key="folder-backdrop"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenFolderId(null)}
            />
            <motion.div
              key="folder-modal"
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              onClick={() => setOpenFolderId(null)}
            >
              <motion.div
                layout
                className="relative h-[min(72vh,500px)] w-[min(88vw,500px)] overflow-y-auto rounded-[34px] border border-white/15 bg-white/20 p-5 shadow-2xl backdrop-blur-2xl md:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <IconButton
                  icon={X}
                  type="button"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenFolderId(null);
                  }}
                  className="absolute right-4 top-4 h-8 w-8 bg-white/20 text-white hover:bg-white/30"
                  aria-label="Close folder"
                />
                <p className="mb-5 text-center text-[clamp(0.75rem,1.4vw,1.05rem)] font-medium text-white/90">
                  {openFolder.label}
                </p>
                <div className="grid grid-cols-3 gap-[clamp(0.5rem,2vw,1.75rem)] place-items-center px-1 py-1 sm:px-2">
                  {openFolderApps.map((app) => (
                    <motion.button
                      key={app.id}
                      type="button"
                      title={app.label}
                      aria-label={app.label}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveAppId(app.id)}
                      className="flex w-full cursor-pointer flex-col items-center gap-[clamp(0.3rem,1vw,0.5rem)] rounded-2xl border border-transparent bg-transparent p-[clamp(0.25rem,0.8vw,0.5rem)] transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
                    >
                      <span className="flex h-[clamp(2.9rem,9vw,5.4rem)] w-[clamp(2.9rem,9vw,5.4rem)] items-center justify-center rounded-[clamp(0.8rem,2vw,1.2rem)] bg-white/85 text-foreground shadow-lg">
                        <app.Icon className="h-[clamp(1.2rem,4.6vw,2.5rem)] w-[clamp(1.2rem,4.6vw,2.5rem)]" />
                      </span>
                      <span className="text-center text-[clamp(0.68rem,1.4vw,0.95rem)] font-medium leading-tight text-white">
                        {app.label}
                      </span>
                    </motion.button>
                  ))}
                  {Array.from({ length: (3 - (openFolderApps.length % 3)) % 3 }).map((_, index) => (
                    <span
                      key={`app-grid-spacer-${index}`}
                      aria-hidden
                      className="h-[clamp(2.9rem,9vw,5.4rem)] w-full"
                    />
                  ))}
                </div>
                {activeAppId ? (
                  <div className="mt-6">
                    {renderFolderContent()}
                  </div>
                ) : null}
              </motion.div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
