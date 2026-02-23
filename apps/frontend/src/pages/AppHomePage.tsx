import {
  Boxes,
  ClipboardList,
  Cog,
  FileText,
  HandCoins,
  Package,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../features/auth/session-store";
import { useSyncActions } from "../features/sync/SyncProvider";
import { useUserAppStore } from "../features/sync/user-app-store";
import { SyncPanel } from "../design-system/organisms/SyncPanel";
import { SettingsPanel } from "../design-system/organisms/SettingsPanel";
import { AppFolder } from "../design-system/organisms/AppFolder";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/molecules/Card";
import {
  getPendingOutboxCount,
  resetTenantSyncState,
} from "../features/sync/engine";

type UserFolderId = "purchase" | "sales" | "inventory" | "settings";
type UserAppId =
  | "purchase-bills"
  | "purchase-orders"
  | "purchase-returns"
  | "sales-bills"
  | "sales-orders"
  | "sales-returns"
  | "inventory-sync"
  | "inventory-items"
  | "inventory-adjustments"
  | "settings-sync";

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
        label: "Item Sync",
        Icon: Boxes,
      },
      {
        id: "inventory-items",
        label: "Items",
        Icon: Package,
      },
      {
        id: "inventory-adjustments",
        label: "Adjustments",
        Icon: ClipboardList,
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    apps: [
      {
        id: "settings-sync",
        label: "Data Sync",
        Icon: Cog,
      },
    ],
  },
];

export function AppHomePage() {
  const navigate = useNavigate();
  const stores = useSessionStore((state) => state.stores);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);
  const identityId = useSessionStore((state) => state.identityId);
  const sku = useUserAppStore((state) => state.sku);
  const name = useUserAppStore((state) => state.name);
  const description = useUserAppStore((state) => state.description);
  const localItems = useUserAppStore((state) => state.localItems);
  const setLocalItems = useUserAppStore((state) => state.setLocalItems);
  const setSku = useUserAppStore((state) => state.setSku);
  const setName = useUserAppStore((state) => state.setName);
  const setDescription = useUserAppStore((state) => state.setDescription);
  const { loading, onQueueItemCreate, onSyncNow } = useSyncActions();
  const activeStoreName = useMemo(
    () =>
      stores.find((store) => store.id === activeStore)?.name ??
      "No store selected",
    [activeStore, stores],
  );
  const isAuthenticated = Boolean(identityId);
  const [openFolderId, setOpenFolderId] = useState<UserFolderId | null>(null);
  const [activeAppId, setActiveAppId] = useState<UserAppId | null>(null);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [resyncing, setResyncing] = useState(false);

  const openFolder = useMemo(
    () => folders.find((folder) => folder.id === openFolderId) ?? null,
    [openFolderId],
  );

  const openFolderApps = useMemo(
    () => openFolder?.apps.slice(0, 9) ?? [],
    [openFolder],
  );

  useEffect(() => {
    if (!activeStore || !isStoreSelected) {
      setPendingOutboxCount(0);
      return;
    }

    let cancelled = false;
    void getPendingOutboxCount(activeStore)
      .then((count) => {
        if (!cancelled) {
          setPendingOutboxCount(count);
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStore, isStoreSelected, loading, resyncing]);

  const handleResync = async () => {
    if (!activeStore || !isStoreSelected || resyncing) {
      return;
    }

    const pendingWarning =
      pendingOutboxCount > 0
        ? `Warning: ${pendingOutboxCount} pending outbox item${pendingOutboxCount === 1 ? "" : "s"} will be deleted and data will be lost.\n\n`
        : "";

    const confirmed = window.confirm(
      `${pendingWarning}This clears local sync data for the active store and pulls a fresh copy from server. Continue?`,
    );
    if (!confirmed) {
      return;
    }

    setResyncing(true);
    try {
      setLocalItems([]);
      await resetTenantSyncState(activeStore);
      await onSyncNow();
    } catch (error) {
      console.error(error);
    } finally {
      setResyncing(false);
    }
  };

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
          localItems={localItems}
          loading={loading}
          isAuthenticated={isAuthenticated}
          activeStore={activeStore}
          isStoreSelected={isStoreSelected}
          onSkuChange={setSku}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onQueueItemCreate={onQueueItemCreate}
          onSyncNow={onSyncNow}
        />
      );
    }

    if (activeAppId === "settings-sync") {
      return (
        <SettingsPanel
          pendingOutboxCount={pendingOutboxCount}
          loading={resyncing || loading}
          disabled={!isAuthenticated || !activeStore || !isStoreSelected}
          onResync={() => {
            void handleResync();
          }}
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
    <main className="min-h-screen w-full space-y-6 p-4 sm:p-6 md:p-10">
      <section>
        <p className="mb-4 text-sm font-medium tracking-[0.01em] text-muted-foreground">
          Apps
        </p>
        <div className="folder-launcher-layout">
          {folders.map((folder) => (
            <div key={folder.id} className="folder-launcher-item">
              <AppFolder
                label={folder.label}
                apps={folder.apps}
                isOpen={openFolderId === folder.id}
                onOpen={() => {
                  setOpenFolderId(folder.id);
                  setActiveAppId(null);
                }}
                onClose={() => setOpenFolderId(null)}
                onSelectApp={(appId) => {
                  if (appId === "inventory-items") {
                    setOpenFolderId(null);
                    setActiveAppId(null);
                    navigate("/app/items");
                    return;
                  }
                  setActiveAppId(appId);
                }}
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
