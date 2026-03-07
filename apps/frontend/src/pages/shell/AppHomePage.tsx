import {
  Boxes,
  ChartColumn,
  ClipboardList,
  Cog,
  FileText,
  FolderKanban,
  HandCoins,
  History,
  MoreHorizontal,
  Package,
  PackageSearch,
  Percent,
  ReceiptText,
  RefreshCcw,
  ScanBarcode,
  ShieldCheck,
  ShoppingBag,
  TicketPercent,
  TrendingUp,
  Undo2,
  Users,
  UserRoundCog,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  hasAssignedStoreCapability,
  useSessionStore,
  type BusinessCapability,
  type BusinessModules,
} from "../../features/auth/session-business";
import { useLogoutFlow } from "../../features/auth/useLogoutFlow";
import { useSyncActions } from "../../features/sync/SyncProvider";
import { getPendingOutboxCount } from "../../features/sync/engine";
import { Button } from "../../design-system/atoms/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import { AppNavButton } from "../../design-system/molecules/AppNavButton";
import { AppTabButton } from "../../design-system/molecules/AppTabButton";
import { LandingAttentionCard } from "../../design-system/molecules/LandingAttentionCard";
import { LandingQuickActionButton } from "../../design-system/molecules/LandingQuickActionButton";
import { LandingRecentActivityItem } from "../../design-system/molecules/LandingRecentActivityItem";

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
  | "catalog-products"
  | "catalog-services"
  | "catalog-product-pricing"
  | "catalog-service-pricing"
  | "catalog-categories"
  | "catalog-collections"
  | "stock-levels"
  | "stock-adjustments"
  | "stock-history"
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
  | "admin-item-sync"
  | "admin-sync";
type RoutableAppId = UserAppId;

type UserFolderApp = {
  id: UserAppId;
  label: string;
  Icon: LucideIcon;
  requiredAnyCapability?: BusinessCapability[];
};

const APP_ROUTE_SEGMENT_BY_ID: Record<RoutableAppId, string> = {
  "sales-bills": "sales-bills",
  "sales-orders": "sales-orders",
  "sales-returns": "sales-returns",
  "catalog-products": "products",
  "catalog-services": "services",
  "catalog-product-pricing": "product-pricing",
  "catalog-service-pricing": "service-pricing",
  "catalog-categories": "item-categories",
  "catalog-collections": "item-collections",
  "stock-levels": "stock-levels",
  "stock-adjustments": "stock-adjustments",
  "stock-history": "stock-history",
  "people-customers": "customers",
  "people-groups": "customer-groups",
  "people-suppliers": "suppliers",
  "promo-rules": "promo-rules",
  "promo-bundles": "promo-bundles",
  "promo-codes": "promo-codes",
  "report-sales": "sales-report",
  "report-items": "top-items-report",
  "report-stock": "stock-value-report",
  "admin-settings": "settings",
  "admin-item-sync": "admin-item-sync",
  "admin-sync": "data-sync",
};

const APP_ID_BY_ROUTE_SEGMENT = Object.fromEntries(
  Object.entries(APP_ROUTE_SEGMENT_BY_ID).map(([appId, segment]) => [segment, appId]),
) as Record<string, RoutableAppId>;

const folders: Array<{
  id: UserFolderId;
  label: string;
  Icon: LucideIcon;
  requiredModule?: keyof BusinessModules;
  apps: UserFolderApp[];
}> = [
  {
    id: "sell",
    label: "Sell",
    Icon: HandCoins,
    requiredModule: "sales",
    apps: [
      {
        id: "sales-bills",
        label: "Bills",
        Icon: HandCoins,
        requiredAnyCapability: ["TXN_SALE_CREATE"],
      },
      {
        id: "sales-orders",
        label: "Orders",
        Icon: FileText,
        requiredAnyCapability: ["TXN_SALE_CREATE"],
      },
      {
        id: "sales-returns",
        label: "Returns",
        Icon: Undo2,
        requiredAnyCapability: ["TXN_SALE_RETURN"],
      },
    ],
  },
  {
    id: "products",
    label: "Catalog",
    Icon: FolderKanban,
    requiredModule: "catalog",
    apps: [
      {
        id: "catalog-products",
        label: "Products",
        Icon: Package,
        requiredAnyCapability: ["ITEM_PRODUCTS"],
      },
      {
        id: "catalog-services",
        label: "Services",
        Icon: Package,
        requiredAnyCapability: ["ITEM_SERVICES"],
      },
      {
        id: "catalog-product-pricing",
        label: "Product Pricing",
        Icon: TicketPercent,
        requiredAnyCapability: ["ITEM_PRODUCTS"],
      },
      {
        id: "catalog-service-pricing",
        label: "Service Pricing",
        Icon: TicketPercent,
        requiredAnyCapability: ["ITEM_SERVICES"],
      },
      {
        id: "catalog-categories",
        label: "Categories",
        Icon: Boxes,
        requiredAnyCapability: ["ITEM_PRODUCTS", "ITEM_SERVICES"],
      },
      {
        id: "catalog-collections",
        label: "Collections",
        Icon: PackageSearch,
        requiredAnyCapability: ["ITEM_PRODUCTS", "ITEM_SERVICES"],
      },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    Icon: Boxes,
    requiredModule: "inventory",
    apps: [
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
      {
        id: "stock-history",
        label: "History",
        Icon: History,
      },
    ],
  },
  {
    id: "people",
    label: "People",
    Icon: Users,
    apps: [
      {
        id: "people-customers",
        label: "Customers",
        Icon: Users,
        requiredAnyCapability: ["PARTIES_CUSTOMERS"],
      },
      {
        id: "people-groups",
        label: "Groups",
        Icon: UserRoundCog,
        requiredAnyCapability: ["PARTIES_CUSTOMERS"],
      },
      {
        id: "people-suppliers",
        label: "Suppliers",
        Icon: ShoppingBag,
        requiredAnyCapability: ["PARTIES_SUPPLIERS"],
      },
    ],
  },
  {
    id: "promotions",
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
    label: "Admin",
    Icon: ShieldCheck,
    apps: [
      {
        id: "admin-settings",
        label: "Business Settings",
        Icon: ShieldCheck,
      },
      {
        id: "admin-item-sync",
        label: "Item Sync",
        Icon: Boxes,
        requiredAnyCapability: ["ITEM_PRODUCTS", "ITEM_SERVICES"],
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
    label: "Find Product",
    description: "Open product catalog",
    folderId: "products",
    appId: "catalog-products",
    Icon: Package,
  },
  {
    label: "Find Service",
    description: "Open service catalog",
    folderId: "products",
    appId: "catalog-services",
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
];

const landingBusinessPulse = [
  { label: "Today sales", value: "₹42,860" },
  { label: "Bills", value: "87" },
  { label: "Avg bill value", value: "₹493" },
];

const MOBILE_NAV_BUTTON_WIDTH_PX = 76;
const MOBILE_NAV_BUTTON_GAP_PX = 4;
const MOBILE_NAV_HORIZONTAL_PADDING_PX = 16;
const MOBILE_NAV_MORE_BUTTON_WIDTH_PX = 76;

export function AppHomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { submit: onLogout } = useLogoutFlow();
  const { loading: isSyncing, onSyncNow } = useSyncActions();
  const businesses = useSessionStore((state) => state.businesses);
  const activeStore = useSessionStore((state) => state.activeStore);
  const activeBusinessModules = useSessionStore((state) => state.activeBusinessModules);
  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeStore) ?? null,
    [activeStore, businesses],
  );
  const activeBusinessName = useMemo(
    () => activeBusiness?.name ?? "No business selected",
    [activeBusiness],
  );
  const [activeFolderId, setActiveFolderId] = useState<UserFolderId | null>(null);
  const [pendingFolderId, setPendingFolderId] = useState<UserFolderId | null>(null);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [mobileVisibleFolderCount, setMobileVisibleFolderCount] = useState(1);
  const appTabsScrollRef = useRef<HTMLDivElement | null>(null);
  const [showAppTabsLeftFade, setShowAppTabsLeftFade] = useState(false);
  const [showAppTabsRightFade, setShowAppTabsRightFade] = useState(false);
  const enabledModules = useMemo(
    () =>
      activeBusinessModules ?? {
        catalog: true,
        inventory: true,
        sales: true,
        pricing: true,
      },
    [activeBusinessModules],
  );
  const visibleFolders = useMemo(
    () =>
      folders
        .filter(
          (folder) =>
            !folder.requiredModule || enabledModules[folder.requiredModule],
        )
        .map((folder) => ({
          ...folder,
          apps: folder.apps.filter(
            (app) =>
              !app.requiredAnyCapability?.length ||
              app.requiredAnyCapability.some((capability) =>
                hasAssignedStoreCapability(activeBusiness, capability),
              ),
          ),
        }))
        .filter((folder) => folder.apps.length > 0),
    [activeBusiness, enabledModules],
  );
  const visibleAppIds = useMemo(
    () => new Set(visibleFolders.flatMap((folder) => folder.apps.map((app) => app.id))),
    [visibleFolders],
  );
  const visibleLandingQuickActions = useMemo(
    () => landingQuickActions.filter((action) => visibleAppIds.has(action.appId)),
    [visibleAppIds],
  );

  const activeFolder = useMemo(
    () => visibleFolders.find((folder) => folder.id === activeFolderId) ?? null,
    [activeFolderId, visibleFolders],
  );
  const mobileVisibleFolders = useMemo(
    () => {
      if (visibleFolders.length <= mobileVisibleFolderCount) {
        return visibleFolders;
      }

      const baseVisible = visibleFolders.slice(0, mobileVisibleFolderCount);
      if (!activeFolderId) {
        return baseVisible;
      }

      if (baseVisible.some((folder) => folder.id === activeFolderId)) {
        return baseVisible;
      }

      const activeFolderEntry = visibleFolders.find((folder) => folder.id === activeFolderId);
      if (!activeFolderEntry) {
        return baseVisible;
      }

      return [...baseVisible.slice(0, Math.max(0, mobileVisibleFolderCount - 1)), activeFolderEntry];
    },
    [activeFolderId, mobileVisibleFolderCount, visibleFolders],
  );
  const mobileOverflowFolders = useMemo(
    () => {
      const visibleIds = new Set(mobileVisibleFolders.map((folder) => folder.id));
      return visibleFolders.filter((folder) => !visibleIds.has(folder.id));
    },
    [mobileVisibleFolders, visibleFolders],
  );

  const routeDrivenAppId: UserAppId | null = useMemo(() => {
    if (!location.pathname.startsWith("/app/")) return null;
    const appSegment = location.pathname.slice("/app/".length).split("/")[0] ?? "";
    if (!appSegment) return null;
    return APP_ID_BY_ROUTE_SEGMENT[appSegment] ?? null;
  }, [location.pathname]);

  const updateAppTabsOverflow = useCallback(() => {
    const container = appTabsScrollRef.current;
    if (!container) {
      setShowAppTabsLeftFade(false);
      setShowAppTabsRightFade(false);
      return;
    }

    const hasOverflow = container.scrollWidth - container.clientWidth > 1;
    if (!hasOverflow) {
      setShowAppTabsLeftFade(false);
      setShowAppTabsRightFade(false);
      return;
    }

    setShowAppTabsLeftFade(container.scrollLeft > 4);
    setShowAppTabsRightFade(
      container.scrollLeft + container.clientWidth < container.scrollWidth - 4,
    );
  }, []);

  useEffect(() => {
    if (visibleFolders.length === 0) {
      queueMicrotask(() => {
        setActiveFolderId(null);
      });
      return;
    }

    if (!activeFolderId || !visibleFolders.some((folder) => folder.id === activeFolderId)) {
      queueMicrotask(() => {
        setActiveFolderId(visibleFolders[0]?.id ?? null);
      });
    }
  }, [activeFolderId, visibleFolders]);

  useEffect(() => {
    if (!routeDrivenAppId) {
      return;
    }
    const matchedFolder = visibleFolders.find((folder) =>
      folder.apps.some((app) => app.id === routeDrivenAppId),
    );
    if (matchedFolder && matchedFolder.id !== activeFolderId) {
      queueMicrotask(() => {
        setActiveFolderId(matchedFolder.id);
      });
    }
  }, [activeFolderId, routeDrivenAppId, visibleFolders]);

  useEffect(() => {
    if (!pendingFolderId) return;
    if (routeDrivenAppId) return;
    queueMicrotask(() => {
      setActiveFolderId(pendingFolderId);
      setPendingFolderId(null);
    });
  }, [pendingFolderId, routeDrivenAppId]);

  useEffect(() => {
    const initialFrameId = window.requestAnimationFrame(() => {
      updateAppTabsOverflow();
    });
    const handleResize = () => updateAppTabsOverflow();
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(initialFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateAppTabsOverflow, activeFolderId, visibleFolders.length]);

  useEffect(() => {
    const container = appTabsScrollRef.current;
    if (!container || !routeDrivenAppId) {
      return;
    }

    const activeButton = container.querySelector<HTMLButtonElement>(
      `button[data-app-id="${routeDrivenAppId}"]`,
    );
    activeButton?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });

    const animationFrameId = window.requestAnimationFrame(updateAppTabsOverflow);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [routeDrivenAppId, updateAppTabsOverflow]);

  useEffect(() => {
    queueMicrotask(() => {
      setShowSessionMenu(false);
    });
  }, [location.pathname]);

  useEffect(() => {
    const updateMobileVisibleFolderCount = () => {
      const viewportWidth = window.innerWidth;
      const availableWidth =
        viewportWidth -
        MOBILE_NAV_HORIZONTAL_PADDING_PX -
        MOBILE_NAV_MORE_BUTTON_WIDTH_PX -
        MOBILE_NAV_BUTTON_GAP_PX;
      const slotWidth = MOBILE_NAV_BUTTON_WIDTH_PX + MOBILE_NAV_BUTTON_GAP_PX;
      const nextCount = Math.max(
        1,
        Math.min(visibleFolders.length, Math.floor((availableWidth + MOBILE_NAV_BUTTON_GAP_PX) / slotWidth)),
      );
      setMobileVisibleFolderCount(nextCount);
    };

    updateMobileVisibleFolderCount();
    window.addEventListener("resize", updateMobileVisibleFolderCount);
    return () => {
      window.removeEventListener("resize", updateMobileVisibleFolderCount);
    };
  }, [visibleFolders.length]);

  useEffect(() => {
    if (!activeStore) {
      queueMicrotask(() => {
        setPendingOutboxCount(0);
      });
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
  }, [activeStore]);

  const handleAppSelect = (appId: UserAppId) => {
    navigate(`/app/${APP_ROUTE_SEGMENT_BY_ID[appId]}`);
  };

  const handleFolderSelect = (folderId: UserFolderId) => {
    setShowSessionMenu(false);
    if (routeDrivenAppId) {
      setPendingFolderId(folderId);
      navigate("/app");
      return;
    }

    setActiveFolderId(folderId);
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
              {visibleLandingQuickActions.map((action) => (
                <LandingQuickActionButton
                  key={action.label}
                  type="button"
                  Icon={action.Icon}
                  label={action.label}
                  description={action.description}
                  onClick={() => {
                    setActiveFolderId(action.folderId);
                    handleAppSelect(action.appId);
                  }}
                />
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
              Placeholder alert layout for future operational exceptions.
            </CardDescription>
          </CardHeader>
            <CardContent className="grid gap-2 p-0">
              {landingAttentionCards.map((card) => (
                <LandingAttentionCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  detail={card.detail}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="p-2">
          <CardHeader className="mb-1 p-0">
            <CardTitle className="text-sm">Recent Work</CardTitle>
            <CardDescription className="text-xs">
              Placeholder activity layout until real history is wired in.
            </CardDescription>
          </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-1.5">
                {landingRecentActivity.slice(0, 4).map((entry) => (
                  <LandingRecentActivityItem key={entry} entry={entry} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="p-2 lg:col-span-4 lg:min-h-0">
          <CardHeader className="mb-1 p-0">
            <CardTitle className="text-sm">Search + Sync</CardTitle>
            <CardDescription className="text-xs">
              Reserved area for future global lookup and sync controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-0">
            <div className="rounded-lg border border-dashed border-[#c6d8ef] bg-[#f7fbff] px-3 py-2 text-[11px] text-muted-foreground">
              Search controls will appear here when global lookup is implemented.
            </div>
            <div className="rounded-lg border border-[#dce8f6] bg-[#fbfdff] px-3 py-2 text-[11px] text-muted-foreground">
              <p>
                Sync summary placeholder for the current business.
              </p>
              <p>
                Current queued item count can be shown here once the shell status card is finalized.
              </p>
              <p>
                Current local outbox count:{" "}
                <span className="font-semibold text-foreground">{pendingOutboxCount}</span>
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => navigate("/app/settings")}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[11px]"
              >
                Open settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  };

  return (
    <main className="h-auto w-full pb-20 sm:pb-24 lg:h-full lg:min-h-0 lg:pb-3">
      <div className="grid w-full gap-2 lg:h-full lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden rounded-xl border border-border/75 bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[132px_minmax(0,1fr)] lg:gap-2 lg:overflow-hidden">
          <div className="min-h-0 border-r border-border/70 pr-2">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Navigation
            </p>
            <div className="space-y-1.5">
              {visibleFolders.map((folder) => (
                <AppNavButton
                  key={folder.id}
                  type="button"
                  onClick={() => handleFolderSelect(folder.id)}
                  Icon={folder.Icon}
                  label={folder.label}
                  active={activeFolder?.id === folder.id}
                  aria-current={activeFolder?.id === folder.id ? "page" : undefined}
                />
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col pl-0.5">
            <p className="px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {activeFolder?.label ?? "App"} Apps
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="space-y-1.5">
                {activeFolder?.apps.map((app) => (
                  <AppTabButton
                    key={app.id}
                    type="button"
                    onClick={() => handleAppSelect(app.id)}
                    Icon={app.Icon}
                    label={app.label}
                    active={routeDrivenAppId === app.id}
                    stacked
                    className="border-border/60 bg-transparent shadow-none hover:bg-white/55"
                  />
                ))}
              </div>
            </div>
            <div className="mt-2 border-t border-border/70 pt-2">
              <p className="px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Session
              </p>
              <div className="grid gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 justify-start gap-2 px-2 text-[11px]"
                  onClick={() => {
                    void onSyncNow();
                  }}
                  disabled={isSyncing}
                  >
                    <RefreshCcw
                      className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    {isSyncing ? "Syncing..." : "Sync"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 justify-start gap-2 px-2 text-[11px]"
                  onClick={() => void onLogout()}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-2 lg:flex lg:min-h-0 lg:flex-col">
          <div className="min-w-0 rounded-xl border border-border/80 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_24px_-20px_rgba(15,23,42,0.18)] lg:hidden">
            <div className="mb-3">
              <p className="text-xs font-semibold tracking-[0.01em] text-foreground/90">
                {activeFolder?.label ?? "Apps"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Choose an app to continue.
              </p>
            </div>
            <div className="relative w-full max-w-full overflow-hidden">
              <div
                ref={appTabsScrollRef}
                onScroll={updateAppTabsOverflow}
                className="flex w-full max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1"
              >
                {activeFolder?.apps.map((app) => (
                  <AppTabButton
                    key={app.id}
                    data-app-id={app.id}
                    type="button"
                    onClick={() => handleAppSelect(app.id)}
                    Icon={app.Icon}
                    label={app.label}
                    active={routeDrivenAppId === app.id}
                  />
                ))}
              </div>
              {showAppTabsLeftFade ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white/95 via-white/70 to-transparent" />
              ) : null}
              {showAppTabsRightFade ? (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/95 via-white/70 to-transparent" />
              ) : null}
            </div>
          </div>

          <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            {routeDrivenAppId ? (
              <section className="app-page-density app-page-typography h-auto min-h-0 lg:h-full lg:overflow-hidden">
                <Outlet />
              </section>
            ) : (
              <section className="h-auto min-h-0 lg:h-full lg:overflow-hidden">
                {renderLandingPlaceholder()}
              </section>
            )}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-white p-2 shadow-[0_-1px_2px_rgba(15,23,42,0.05)] lg:hidden">
        {showSessionMenu ? (
          <div className="absolute inset-x-2 bottom-full z-50 mb-2 rounded-lg border border-border/80 bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
            <div className="grid gap-1">
              {mobileOverflowFolders.map((folder) => (
                <Button
                  key={folder.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-full justify-start gap-2 px-3 text-[12px]"
                  onClick={() => handleFolderSelect(folder.id)}
                >
                  <folder.Icon className="h-4 w-4" aria-hidden="true" />
                  {folder.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-full justify-start gap-2 px-3 text-[12px]"
                onClick={() => {
                  setShowSessionMenu(false);
                  void onSyncNow();
                }}
                disabled={isSyncing}
              >
                <RefreshCcw
                  className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {isSyncing ? "Syncing..." : "Sync"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-full justify-start gap-2 px-3 text-[12px] text-[#8a2b2b] hover:bg-[#fce8e8] hover:text-[#7a1f1f]"
                onClick={() => {
                  setShowSessionMenu(false);
                  void onLogout();
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex gap-1 overflow-hidden pb-1">
              {mobileVisibleFolders.map((folder) => (
                <AppNavButton
                  key={folder.id}
                  type="button"
                  onClick={() => handleFolderSelect(folder.id)}
                  Icon={folder.Icon}
                  label={folder.label}
                  active={activeFolder?.id === folder.id}
                  compact
                  aria-current={activeFolder?.id === folder.id ? "page" : undefined}
                />
              ))}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="flex min-h-14 min-w-[4.8rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] leading-tight text-foreground/75 hover:bg-white/80"
            onClick={() => setShowSessionMenu((current) => !current)}
            aria-expanded={showSessionMenu}
            aria-label="Open more options"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="text-center">More</span>
          </Button>
        </div>
      </nav>
    </main>
  );
}
