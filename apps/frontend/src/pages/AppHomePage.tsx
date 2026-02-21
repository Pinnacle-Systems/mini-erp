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
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { SyncPanel } from "../design-system/organisms/SyncPanel";
import { AppFolder } from "../design-system/organisms/AppFolder";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/molecules/Card";

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
  },
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
  onSyncNow,
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
              {openFolderApps.find((app) => app.id === activeAppId)?.label ??
                "Purchase"}
              .
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
              {openFolderApps.find((app) => app.id === activeAppId)?.label ??
                "Sales"}
              .
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
            <div
              key={folder.id}
              className="w-full md:max-w-[14rem] md:justify-self-center"
            >
              <AppFolder
                label={folder.label}
                apps={folder.apps}
                isOpen={openFolderId === folder.id}
                onOpen={() => {
                  setOpenFolderId(folder.id);
                  setActiveAppId(null);
                }}
                onClose={() => setOpenFolderId(null)}
                onSelectApp={setActiveAppId}
              >
                {openFolderId === folder.id && activeAppId ? (
                  <div className="mt-6">{renderFolderContent()}</div>
                ) : null}
              </AppFolder>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
