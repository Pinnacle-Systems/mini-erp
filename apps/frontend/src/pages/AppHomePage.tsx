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
import { Outlet, useLocation, useNavigate } from "react-router-dom";
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

const landingQuickActions: Array<{
  label: string;
  description: string;
  folderId: UserFolderId;
  appId: UserAppId;
  Icon: LucideIcon;
}> = [
  {
    label: "New Bill",
    description: "Start billing",
    folderId: "sell",
    appId: "sales-bills",
    Icon: HandCoins,
  },
  {
    label: "Find Item",
    description: "Open item catalog",
    folderId: "products",
    appId: "catalog-items",
    Icon: Package,
  },
  {
    label: "Adjust Stock",
    description: "Update stock levels",
    folderId: "stock",
    appId: "stock-adjustments",
    Icon: ClipboardList,
  },
];

const landingAttentionCards = [
  {
    label: "Low stock",
    value: "14",
    detail: "3 items below reorder level",
  },
  {
    label: "Pending returns",
    value: "6",
    detail: "2 require manager review",
  },
  {
    label: "Open orders",
    value: "11",
    detail: "5 due before 6 PM",
  },
];

const landingRecentActivity = [
  "Bill #B-2041 edited by Rina",
  "Item 'Basmati Rice 5KG' repriced",
  "Customer 'Asha Traders' added",
  "Stock adjusted for SKU ST-992",
  "Promo code 'WEEKEND5' activated",
];

const landingBusinessPulse = [
  { label: "Today sales", value: "INR 42,860" },
  { label: "Bills", value: "87" },
  { label: "Avg bill value", value: "INR 493" },
];

export function AppHomePage() {
  const location = useLocation();
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
  const isItemsRoute = location.pathname.startsWith("/app/items");

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
    if (!isItemsRoute) {
      return;
    }
    if (activeFolderId !== "products") {
      setActiveFolderId("products");
    }
    if (activeAppId !== "catalog-items") {
      setActiveAppId("catalog-items");
    }
  }, [activeAppId, activeFolderId, isItemsRoute]);

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
      setActiveAppId("catalog-items");
      navigate("/app/items");
      return;
    }
    if (isItemsRoute) {
      navigate("/app");
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

  const renderLandingPlaceholder = () => {
    return (
      <section className="space-y-2 lg:grid lg:h-full lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-2 lg:space-y-0 lg:overflow-hidden">
        <Card className="p-2 lg:col-span-8">
          <CardHeader className="mb-0">
            <CardTitle className="text-base">Today Ops</CardTitle>
            <CardDescription className="text-xs">
              Placeholder dashboard for <strong>{activeBusinessName}</strong>. Replace each card with live data as modules are implemented.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {landingQuickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  setActiveFolderId(action.folderId);
                  handleAppSelect(action.appId);
                }}
                className="flex items-center gap-2 rounded-xl border border-white/75 bg-white/70 px-3 py-2 text-left transition hover:bg-white"
              >
                <action.Icon className="h-4 w-4 shrink-0 text-[#24507e]" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {action.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {action.description}
                  </span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-2 sm:grid-cols-3 lg:col-span-4">
          {landingBusinessPulse.map((metric) => (
            <Card key={metric.label} className="p-2">
              <CardContent className="p-0">
                <p className="text-[11px] text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-2 lg:col-span-8 lg:min-h-0 lg:grid-cols-2">
          <Card className="p-2">
            <CardHeader className="mb-1 p-0">
              <CardTitle className="text-sm">Needs Attention</CardTitle>
              <CardDescription className="text-xs">
                Dummy operational alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 p-0">
              {landingAttentionCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-[#d6e4f5] bg-[#f8fbff] p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{card.label}</p>
                    <span className="rounded-full bg-[#e8f2ff] px-2 py-0.5 text-[10px] font-semibold text-[#24507e]">
                      {card.value}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{card.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="p-2">
            <CardHeader className="mb-1 p-0">
              <CardTitle className="text-sm">Recent Work</CardTitle>
              <CardDescription className="text-xs">
                Dummy recent activity feed.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-1.5">
                {landingRecentActivity.slice(0, 4).map((entry) => (
                  <li
                    key={entry}
                    className="rounded-lg border border-white/75 bg-white/70 px-2 py-1.5 text-[11px] text-foreground/85"
                  >
                    {entry}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="p-2 lg:col-span-4 lg:min-h-0">
          <CardHeader className="mb-1 p-0">
            <CardTitle className="text-sm">Search + Sync</CardTitle>
            <CardDescription className="text-xs">
              Placeholder for global lookup and sync controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-0">
            <div className="rounded-lg border border-dashed border-[#c6d8ef] bg-[#f7fbff] px-3 py-2 text-[11px] text-muted-foreground">
              Search box placeholder: try name, SKU, barcode, or phone.
            </div>
            <div className="rounded-lg border border-[#dce8f6] bg-[#fbfdff] px-3 py-2 text-[11px] text-muted-foreground">
              <p>
                Pending outbox items:{" "}
                <span className="font-semibold text-foreground">{pendingOutboxCount}</span>
              </p>
              <p>
                Current state:{" "}
                <span className="font-semibold text-foreground">
                  {resyncing || loading ? "Sync in progress" : "Ready"}
                </span>
              </p>
              <p>Last successful sync: 09:42 AM (dummy)</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate("/app/settings")}
                className="h-8 rounded-full border border-[#9cb5d2] bg-gradient-to-b from-[#f8fbff] to-[#e7f1ff] px-3 text-[11px] font-semibold text-[#15314e] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(21,49,78,0.5)] transition hover:from-[#ffffff] hover:to-[#edf5ff]"
              >
                Open settings
              </button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  };

  return (
    <main className="h-auto w-full pb-20 sm:pb-24 lg:h-full lg:min-h-0 lg:pb-3">
      <div className="grid w-full gap-2 lg:h-full lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border border-white/70 bg-white/60 p-2 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl lg:block lg:h-full lg:overflow-y-auto">
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Navigation
          </p>
          <div className="space-y-1.5">
            {visibleFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  setActiveFolderId(folder.id);
                  setActiveAppId(null);
                  if (isItemsRoute) {
                    navigate("/app");
                  }
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
        </aside>

        <section className="space-y-2 lg:flex lg:min-h-0 lg:flex-col">
          <div className="rounded-2xl border border-white/70 bg-white/60 p-2 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl">
            <div className="mb-3">
              <p className="text-xs font-semibold tracking-[0.01em] text-foreground/90">
                {activeFolder?.label ?? "Apps"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Choose an app to continue.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {activeFolder?.apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => handleAppSelect(app.id)}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs transition ${
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

          <div
            className={`space-y-2 lg:min-h-0 ${
              isItemsRoute
                ? "lg:flex-1 lg:overflow-hidden"
                : activeAppId
                  ? "lg:overflow-y-auto lg:pr-1"
                  : "lg:flex-1 lg:overflow-hidden"
            }`}
          >
            {isItemsRoute ? (
              <section className="space-y-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                <Outlet />
              </section>
            ) : activeAppId ? (
              <section className="space-y-2">{renderFolderContent()}</section>
            ) : (
              renderLandingPlaceholder()
            )}

            {activeAppId && !isItemsRoute ? (
              <section className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/app/settings")}
                  className="h-8 rounded-full border border-[#9cb5d2] bg-gradient-to-b from-[#f8fbff] to-[#e7f1ff] px-3 text-[11px] font-semibold text-[#15314e] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(21,49,78,0.5)] transition hover:from-[#ffffff] hover:to-[#edf5ff]"
                >
                  Open settings
                </button>
              </section>
            ) : null}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/90 p-2 backdrop-blur-xl lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {visibleFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => {
                setActiveFolderId(folder.id);
                setActiveAppId(null);
                if (isItemsRoute) {
                  navigate("/app");
                }
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
