import {
  Boxes,
  ChartColumn,
  ClipboardList,
  Cog,
  FileText,
  FolderKanban,
  HandCoins,
  Package,
  PackageSearch,
  Percent,
  ReceiptText,
  ScanBarcode,
  ShieldCheck,
  ShoppingBag,
  TicketPercent,
  TrendingUp,
  Undo2,
  Users,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore, type BusinessModules } from "../features/auth/session-business";
import { useSyncActions } from "../features/sync/SyncProvider";
import { useUserAppStore } from "../features/sync/user-app-business";
import { SyncPanel } from "../design-system/organisms/SyncPanel";
import { SettingsPanel } from "../design-system/organisms/SettingsPanel";
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

type FolderGroupId = "daily-ops" | "merchandising" | "control";
type UserFolderId =
  | "sell"
  | "products"
  | "stock"
  | "people"
  | "promotions"
  | "reports"
  | "admin";
type UserAppId =
  | "sales-bills"
  | "sales-orders"
  | "sales-returns"
  | "catalog-items"
  | "catalog-pricing"
  | "catalog-categories"
  | "stock-sync"
  | "stock-levels"
  | "stock-adjustments"
  | "people-customers"
  | "people-groups"
  | "people-suppliers"
  | "promo-rules"
  | "promo-bundles"
  | "promo-codes"
  | "report-sales"
  | "report-items"
  | "report-stock"
  | "admin-settings"
  | "admin-sync";

type UserFolderApp = {
  id: UserAppId;
  label: string;
  Icon: LucideIcon;
};

const folders: Array<{
  id: UserFolderId;
  group: FolderGroupId;
  label: string;
  Icon: LucideIcon;
  requiredModule?: keyof BusinessModules;
  apps: UserFolderApp[];
}> = [
  {
    id: "sell",
    group: "daily-ops",
    label: "Sell",
    Icon: HandCoins,
    apps: [
      {
        id: "sales-bills",
        label: "Bills",
        Icon: HandCoins,
      },
      {
        id: "sales-orders",
        label: "Orders",
        Icon: FileText,
      },
      {
        id: "sales-returns",
        label: "Returns",
        Icon: Undo2,
      },
    ],
  },
  {
    id: "products",
    group: "merchandising",
    label: "Catalog",
    Icon: FolderKanban,
    requiredModule: "catalog",
    apps: [
      {
        id: "catalog-items",
        label: "Items",
        Icon: Package,
      },
      {
        id: "catalog-pricing",
        label: "Pricing",
        Icon: TicketPercent,
      },
      {
        id: "catalog-categories",
        label: "Categories",
        Icon: Boxes,
      },
    ],
  },
  {
    id: "stock",
    group: "daily-ops",
    label: "Stock",
    Icon: Boxes,
    requiredModule: "inventory",
    apps: [
      {
        id: "stock-sync",
        label: "Item Sync",
        Icon: Boxes,
      },
      {
        id: "stock-levels",
        label: "Levels",
        Icon: ScanBarcode,
      },
      {
        id: "stock-adjustments",
        label: "Adjustments",
        Icon: ClipboardList,
      },
    ],
  },
  {
    id: "people",
    group: "merchandising",
    label: "People",
    Icon: Users,
    apps: [
      {
        id: "people-customers",
        label: "Customers",
        Icon: Users,
      },
      {
        id: "people-groups",
        label: "Groups",
        Icon: UserRoundCog,
      },
      {
        id: "people-suppliers",
        label: "Suppliers",
        Icon: ShoppingBag,
      },
    ],
  },
  {
    id: "promotions",
    group: "merchandising",
    label: "Promotions",
    Icon: Percent,
    requiredModule: "pricing",
    apps: [
      {
        id: "promo-rules",
        label: "Rules",
        Icon: Percent,
      },
      {
        id: "promo-bundles",
        label: "Bundles",
        Icon: PackageSearch,
      },
      {
        id: "promo-codes",
        label: "Codes",
        Icon: ReceiptText,
      },
    ],
  },
  {
    id: "reports",
    group: "control",
    label: "Reports",
    Icon: ChartColumn,
    apps: [
      {
        id: "report-sales",
        label: "Sales",
        Icon: ChartColumn,
      },
      {
        id: "report-items",
        label: "Top Items",
        Icon: TrendingUp,
      },
      {
        id: "report-stock",
        label: "Stock Value",
        Icon: Boxes,
      },
    ],
  },
  {
    id: "admin",
    group: "control",
    label: "Admin",
    Icon: ShieldCheck,
    apps: [
      {
        id: "admin-settings",
        label: "Business Settings",
        Icon: ShieldCheck,
      },
      {
        id: "admin-sync",
        label: "Data Sync",
        Icon: Cog,
      },
    ],
  },
];

const folderGroups: Array<{
  id: FolderGroupId;
  label: string;
  description: string;
}> = [
  {
    id: "daily-ops",
    label: "Daily Ops",
    description: "Frequent counterside actions",
  },
  {
    id: "merchandising",
    label: "Merchandising",
    description: "Catalog, people, and promotions",
  },
  {
    id: "control",
    label: "Control",
    description: "Reports and admin tooling",
  },
];

export function AppHomePage() {
  const navigate = useNavigate();
  const businesses = useSessionStore((state) => state.businesses);
  const activeStore = useSessionStore((state) => state.activeStore);
  const activeBusinessModules = useSessionStore((state) => state.activeBusinessModules);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const identityId = useSessionStore((state) => state.identityId);
  const sku = useUserAppStore((state) => state.sku);
  const name = useUserAppStore((state) => state.name);
  const localItems = useUserAppStore((state) => state.localItems);
  const setLocalItems = useUserAppStore((state) => state.setLocalItems);
  const setSku = useUserAppStore((state) => state.setSku);
  const setName = useUserAppStore((state) => state.setName);
  const { loading, onQueueItemCreate, onSyncNow } = useSyncActions();
  const activeBusinessName = useMemo(
    () =>
      businesses.find((business) => business.id === activeStore)?.name ??
      "No business selected",
    [activeStore, businesses],
  );
  const isAuthenticated = Boolean(identityId);
  const [activeFolderId, setActiveFolderId] = useState<UserFolderId | null>(null);
  const [activeAppId, setActiveAppId] = useState<UserAppId | null>(null);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [resyncing, setResyncing] = useState(false);
  const enabledModules = useMemo(
    () =>
      activeBusinessModules ?? {
        catalog: true,
        inventory: true,
        pricing: true,
      },
    [activeBusinessModules],
  );

  const visibleFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          !folder.requiredModule || enabledModules[folder.requiredModule],
      ),
    [enabledModules],
  );

  const activeFolder = useMemo(
    () => visibleFolders.find((folder) => folder.id === activeFolderId) ?? null,
    [activeFolderId, visibleFolders],
  );

  const activeApp = useMemo(
    () =>
      visibleFolders
        .flatMap((folder) => folder.apps)
        .find((app) => app.id === activeAppId) ?? null,
    [activeAppId, visibleFolders],
  );

  useEffect(() => {
    if (visibleFolders.length === 0) {
      setActiveFolderId(null);
      setActiveAppId(null);
      return;
    }

    if (!activeFolderId || !visibleFolders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId(visibleFolders[0]?.id ?? null);
      setActiveAppId(null);
      return;
    }

    if (activeAppId) {
      const appVisible = visibleFolders.some((folder) =>
        folder.apps.some((app) => app.id === activeAppId),
      );
      if (!appVisible) {
        setActiveAppId(null);
      }
    }
  }, [activeAppId, activeFolderId, visibleFolders]);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
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
  }, [activeStore, isBusinessSelected, loading, resyncing]);

  const handleResync = async () => {
    if (!activeStore || !isBusinessSelected || resyncing) {
      return;
    }

    const pendingWarning =
      pendingOutboxCount > 0
        ? `Warning: ${pendingOutboxCount} pending outbox item${pendingOutboxCount === 1 ? "" : "s"} will be deleted and data will be lost.\n\n`
        : "";

    const confirmed = window.confirm(
      `${pendingWarning}This clears local sync data for the active business and pulls a fresh copy from server. Continue?`,
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

  const handleAppSelect = (appId: UserAppId) => {
    if (appId === "catalog-items") {
      setActiveAppId(null);
      navigate("/app/items");
      return;
    }
    setActiveAppId(appId);
  };

  const renderFolderContent = () => {
    if (!activeAppId) {
      return null;
    }

    if (activeAppId === "stock-sync") {
      return (
        <SyncPanel
          sku={sku}
          name={name}
          localItems={localItems}
          loading={loading}
          isAuthenticated={isAuthenticated}
          activeStore={activeStore}
          isBusinessSelected={isBusinessSelected}
          onSkuChange={setSku}
          onNameChange={setName}
          onQueueItemCreate={onQueueItemCreate}
          onSyncNow={onSyncNow}
        />
      );
    }

    if (activeAppId === "admin-sync") {
      return (
        <SettingsPanel
          pendingOutboxCount={pendingOutboxCount}
          loading={resyncing || loading}
          disabled={!isAuthenticated || !activeStore || !isBusinessSelected}
          onResync={() => {
            void handleResync();
          }}
        />
      );
    }

    if (activeAppId.startsWith("sales")) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Sell</CardTitle>
            <CardDescription>
              <strong>{activeBusinessName}</strong> sell app: {activeApp?.label ?? "Sell"}.
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

    if (activeAppId.startsWith("catalog")) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>
              <strong>{activeBusinessName}</strong> catalog app: {activeApp?.label ?? "Catalog"}.
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

    const sectionLabel = activeAppId.startsWith("stock")
      ? "Stock"
      : activeAppId.startsWith("people")
        ? "People"
        : activeAppId.startsWith("promo")
          ? "Promotions"
          : activeAppId.startsWith("report")
            ? "Reports"
            : "Admin";

    return (
      <Card>
        <CardHeader>
          <CardTitle>{sectionLabel}</CardTitle>
          <CardDescription>
            <strong>{activeBusinessName}</strong> {sectionLabel.toLowerCase()} app: {activeApp?.label ?? sectionLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            App content will be added here.
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <main className="min-h-screen w-full p-4 pb-24 sm:p-6 sm:pb-28 md:p-10 lg:pb-10">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden rounded-3xl border border-white/70 bg-white/60 p-3 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl lg:block">
          {folderGroups.map((group) =>
            visibleFolders.some((folder) => folder.group === group.id) ? (
              <section key={group.id} className="mb-4 space-y-2 last:mb-0">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {group.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">{group.description}</p>
                </div>
                <div className="space-y-1.5">
                  {visibleFolders
                    .filter((folder) => folder.group === group.id)
                    .map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => {
                          setActiveFolderId(folder.id);
                          setActiveAppId(null);
                        }}
                        aria-current={activeFolder?.id === folder.id ? "page" : undefined}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                          activeFolder?.id === folder.id
                            ? "bg-[#e8f2ff] text-[#163a63]"
                            : "text-foreground/80 hover:bg-white/70"
                        }`}
                      >
                        <folder.Icon className="h-4 w-4 shrink-0" />
                        <span>{folder.label}</span>
                      </button>
                    ))}
                </div>
              </section>
            ) : null,
          )}
        </aside>

        <section className="space-y-4">
          <div className="rounded-3xl border border-white/70 bg-white/60 p-4 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:p-5">
            <div className="mb-3">
              <p className="text-sm font-semibold tracking-[0.01em] text-foreground/90">
                {activeFolder?.label ?? "Apps"}
              </p>
              <p className="text-xs text-muted-foreground">
                Choose an app to continue.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {activeFolder?.apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => handleAppSelect(app.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    activeAppId === app.id
                      ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
                      : "border-border/70 bg-white/70 text-foreground/80 hover:bg-white"
                  }`}
                >
                  <app.Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{app.label}</span>
                </button>
              ))}
            </div>
          </div>

          {activeAppId ? (
            <section className="space-y-4">{renderFolderContent()}</section>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Pick an app</CardTitle>
                <CardDescription>
                  Select one app from {activeFolder?.label ?? "navigation"}.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <section className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/app/settings")}
              className="h-10 rounded-full border border-[#9cb5d2] bg-gradient-to-b from-[#f8fbff] to-[#e7f1ff] px-4 text-xs font-semibold text-[#15314e] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(21,49,78,0.5)] transition hover:from-[#ffffff] hover:to-[#edf5ff]"
            >
              Open settings
            </button>
          </section>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/90 p-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto pb-1">
          {visibleFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => {
                setActiveFolderId(folder.id);
                setActiveAppId(null);
              }}
              aria-current={activeFolder?.id === folder.id ? "page" : undefined}
              className={`flex min-h-14 min-w-[4.8rem] flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] leading-tight transition ${
                activeFolder?.id === folder.id
                  ? "bg-[#e8f2ff] text-[#163a63]"
                  : "text-foreground/75 hover:bg-white/80"
              }`}
            >
              <folder.Icon className="h-4 w-4" />
              <span className="text-center">{folder.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
