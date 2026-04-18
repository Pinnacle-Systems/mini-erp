import {
  Boxes,
  ChartColumn,
  ClipboardList,
  Cog,
  FileText,
  FolderKanban,
  HandCoins,
  History,
  LayoutGrid,
  MoreHorizontal,
  PanelLeft,
  Package,
  PackageSearch,
  Percent,
  ReceiptText,
  RefreshCcw,
  ScanBarcode,
  ShieldCheck,
  ShoppingBag,
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
  | "finance"
  | "sell"
  | "buy"
  | "products"
  | "stock"
  | "people"
  | "promotions"
  | "reports"
  | "admin";
type UserAppId =
  | "finance-overview"
  | "finance-received"
  | "finance-made"
  | "finance-expenses"
  | "finance-accounts"
  | "sales-estimates"
  | "sales-pos"
  | "sales-bills"
  | "sales-orders"
  | "delivery-challans"
  | "sales-returns"
  | "purchase-orders"
  | "purchase-grns"
  | "purchase-invoices"
  | "purchase-returns"
  | "catalog-products"
  | "catalog-services"
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

type UserFolderNavEntry = {
  key: string;
  label: string;
  Icon: LucideIcon;
  appId?: UserAppId;
  isHome?: boolean;
};

const APP_ROUTE_SEGMENT_BY_ID: Record<RoutableAppId, string> = {
  "finance-overview": "finance-overview",
  "finance-received": "payments-received",
  "finance-made": "payments-made",
  "finance-expenses": "expenses",
  "finance-accounts": "financial-accounts",
  "sales-estimates": "sales-estimates",
  "sales-pos": "sales-pos",
  "sales-bills": "sales-bills",
  "sales-orders": "sales-orders",
  "delivery-challans": "delivery-challans",
  "sales-returns": "sales-returns",
  "purchase-orders": "purchase-orders",
  "purchase-grns": "goods-receipt-notes",
  "purchase-invoices": "purchase-invoices",
  "purchase-returns": "purchase-returns",
  "catalog-products": "products",
  "catalog-services": "services",
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
  Object.entries(APP_ROUTE_SEGMENT_BY_ID).map(([appId, segment]) => [
    segment,
    appId,
  ]),
) as Record<string, RoutableAppId>;

const getFolderIdForAppId = (appId: UserAppId | null): UserFolderId | null => {
  if (!appId) {
    return null;
  }

  return (
    folders.find((folder) => folder.apps.some((app) => app.id === appId))?.id ??
    null
  );
};

const inferFolderIdFromPathname = (pathname: string): UserFolderId | null => {
  if (!pathname.startsWith("/app/")) {
    return null;
  }

  const appSegment = pathname.slice("/app/".length).split("/")[0] ?? "";
  return getFolderIdForAppId(APP_ID_BY_ROUTE_SEGMENT[appSegment] ?? null);
};

const folders: Array<{
  id: UserFolderId;
  label: string;
  Icon: LucideIcon;
  requiredModule?: keyof BusinessModules;
  apps: UserFolderApp[];
}> = [
  {
    id: "finance",
    label: "Finance",
    Icon: ReceiptText,
    requiredModule: "accounts",
    apps: [
      {
        id: "finance-overview",
        label: "Overview",
        Icon: LayoutGrid,
        requiredAnyCapability: ["FINANCE_RECEIVABLES", "FINANCE_PAYABLES"],
      },
      {
        id: "finance-received",
        label: "Payments Received",
        Icon: HandCoins,
        requiredAnyCapability: ["FINANCE_RECEIVABLES"],
      },
      {
        id: "finance-made",
        label: "Payments Made",
        Icon: FileText,
        requiredAnyCapability: ["FINANCE_PAYABLES"],
      },
      {
        id: "finance-expenses",
        label: "Expenses",
        Icon: ReceiptText,
        requiredAnyCapability: ["FINANCE_PAYABLES"],
      },
      {
        id: "finance-accounts",
        label: "Accounts",
        Icon: Cog,
        requiredAnyCapability: ["FINANCE_RECEIVABLES", "FINANCE_PAYABLES"],
      },
    ],
  },
  {
    id: "sell",
    label: "Sell",
    Icon: HandCoins,
    requiredModule: "sales",
    apps: [
      {
        id: "sales-estimates",
        label: "Estimates",
        Icon: ClipboardList,
        requiredAnyCapability: ["TXN_SALE_CREATE"],
      },
      {
        id: "sales-pos",
        label: "POS",
        Icon: ScanBarcode,
        requiredAnyCapability: ["TXN_SALE_CREATE"],
      },
      {
        id: "sales-bills",
        label: "Invoices",
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
        id: "delivery-challans",
        label: "Delivery Challans",
        Icon: ReceiptText,
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
    id: "buy",
    label: "Purchases",
    Icon: ShoppingBag,
    requiredModule: "purchases",
    apps: [
      {
        id: "purchase-orders",
        label: "Orders",
        Icon: ClipboardList,
        requiredAnyCapability: ["TXN_PURCHASE_CREATE"],
      },
      {
        id: "purchase-grns",
        label: "Goods Receipts",
        Icon: ReceiptText,
        requiredAnyCapability: ["TXN_PURCHASE_CREATE"],
      },
      {
        id: "purchase-invoices",
        label: "Invoices",
        Icon: FileText,
        requiredAnyCapability: ["TXN_PURCHASE_CREATE"],
      },
      {
        id: "purchase-returns",
        label: "Returns",
        Icon: Undo2,
        requiredAnyCapability: ["TXN_PURCHASE_RETURN"],
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
  { label: "Invoices", value: "87" },
  { label: "Avg invoice value", value: "₹493" },
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
  const activeBusinessModules = useSessionStore(
    (state) => state.activeBusinessModules,
  );
  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeStore) ?? null,
    [activeStore, businesses],
  );
  const activeBusinessName = useMemo(
    () => activeBusiness?.name ?? "No business selected",
    [activeBusiness],
  );
  const routeDrivenAppId: UserAppId | null = useMemo(() => {
    if (!location.pathname.startsWith("/app/")) return null;
    const appSegment =
      location.pathname.slice("/app/".length).split("/")[0] ?? "";
    if (!appSegment) return null;
    return APP_ID_BY_ROUTE_SEGMENT[appSegment] ?? null;
  }, [location.pathname]);
  const routeDrivenFolderId = useMemo(
    () => getFolderIdForAppId(routeDrivenAppId),
    [routeDrivenAppId],
  );
  const [activeFolderId, setActiveFolderId] = useState<UserFolderId | null>(
    () =>
      typeof window === "undefined"
        ? null
        : inferFolderIdFromPathname(window.location.pathname),
  );
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [mobileVisibleFolderCount, setMobileVisibleFolderCount] = useState(1);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(max-width: 1023px)").matches,
  );
  const appTabsScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopSidebarRef = useRef<HTMLDivElement | null>(null);
  const previousPathnameRef = useRef(location.pathname);
  const [showAppTabsLeftFade, setShowAppTabsLeftFade] = useState(false);
  const [showAppTabsRightFade, setShowAppTabsRightFade] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(
    () => {
      if (typeof window === "undefined") {
        return false;
      }

      const initialActiveStore = useSessionStore.getState().activeStore;
      return (
        window.localStorage.getItem(
          `user-shell-sidebar-collapsed:${initialActiveStore ?? "global"}`,
        ) === "true"
      );
    },
  );
  const [showCollapsedFolderFlyout, setShowCollapsedFolderFlyout] =
    useState(false);
  const enabledModules = useMemo(
    () =>
      activeBusinessModules ?? {
        accounts: true,
        catalog: true,
        inventory: true,
        purchases: true,
        sales: true,
        pricing: true,
      },
    [activeBusinessModules],
  );
  const desktopSidebarStorageKey = useMemo(
    () => `user-shell-sidebar-collapsed:${activeStore ?? "global"}`,
    [activeStore],
  );

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);

    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);

    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const storedValue = window.localStorage.getItem(desktopSidebarStorageKey);
      setIsDesktopSidebarCollapsed(storedValue === "true");
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [desktopSidebarStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      desktopSidebarStorageKey,
      String(isDesktopSidebarCollapsed),
    );
  }, [desktopSidebarStorageKey, isDesktopSidebarCollapsed]);

  const visibleFolders = useMemo(() => {
    const filteredFolders = folders
      .filter(
        (folder) =>
          !folder.requiredModule || enabledModules[folder.requiredModule],
      )
      .map((folder) => ({
        ...folder,
        apps: folder.apps.filter((app) => {
          if (app.id === "sales-pos" && (!isOnline || isMobileViewport)) {
            return false;
          }

          return (
            !app.requiredAnyCapability?.length ||
            app.requiredAnyCapability.some((capability) =>
              hasAssignedStoreCapability(activeBusiness, capability),
            )
          );
        }),
      }))
      .filter((folder) => folder.apps.length > 0);

    const hasRouteFolder = routeDrivenAppId
      ? filteredFolders.some((folder) =>
          folder.apps.some((app) => app.id === routeDrivenAppId),
        )
      : true;

    if (!hasRouteFolder && routeDrivenAppId) {
      const routeFolder = folders.find((folder) =>
        folder.apps.some((app) => app.id === routeDrivenAppId),
      );

      if (routeFolder) {
        const routeFolderApps = routeFolder.apps.filter((app) => {
          if (app.id === "sales-pos" && (!isOnline || isMobileViewport)) {
            return false;
          }

          return (
            !app.requiredAnyCapability?.length ||
            app.requiredAnyCapability.some((capability) =>
              hasAssignedStoreCapability(activeBusiness, capability),
            )
          );
        });

        if (routeFolderApps.length > 0) {
          filteredFolders.push({
            ...routeFolder,
            apps: routeFolderApps,
          });
        }
      }
    }

    return filteredFolders;
  }, [
    activeBusiness,
    enabledModules,
    isMobileViewport,
    isOnline,
    routeDrivenAppId,
  ]);
  const visibleAppIds = useMemo(
    () =>
      new Set(
        visibleFolders.flatMap((folder) => folder.apps.map((app) => app.id)),
      ),
    [visibleFolders],
  );
  const visibleLandingQuickActions = useMemo(
    () =>
      landingQuickActions.filter((action) => visibleAppIds.has(action.appId)),
    [visibleAppIds],
  );

  const activeFolder = useMemo(
    () => visibleFolders.find((folder) => folder.id === activeFolderId) ?? null,
    [activeFolderId, visibleFolders],
  );
  const activeFolderNavEntries = useMemo<UserFolderNavEntry[]>(
    () =>
      activeFolder
        ? [
            {
              key: `${activeFolder.id}-home`,
              label: `${activeFolder.label} Home`,
              Icon: LayoutGrid,
              isHome: true,
            },
            ...activeFolder.apps.map((app) => ({
              key: app.id,
              label: app.label,
              Icon: app.Icon,
              appId: app.id,
            })),
          ]
        : [],
    [activeFolder],
  );
  const shouldShowCollapsedFolderFlyout =
    isDesktopSidebarCollapsed &&
    showCollapsedFolderFlyout &&
    Boolean(activeFolder);
  const mobileVisibleFolders = useMemo(() => {
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

    const activeFolderEntry = visibleFolders.find(
      (folder) => folder.id === activeFolderId,
    );
    if (!activeFolderEntry) {
      return baseVisible;
    }

    return [
      ...baseVisible.slice(0, Math.max(0, mobileVisibleFolderCount - 1)),
      activeFolderEntry,
    ];
  }, [activeFolderId, mobileVisibleFolderCount, visibleFolders]);
  const mobileOverflowFolders = useMemo(() => {
    const visibleIds = new Set(mobileVisibleFolders.map((folder) => folder.id));
    return visibleFolders.filter((folder) => !visibleIds.has(folder.id));
  }, [mobileVisibleFolders, visibleFolders]);

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

    if (
      !activeFolderId ||
      !visibleFolders.some((folder) => folder.id === activeFolderId)
    ) {
      queueMicrotask(() => {
        setActiveFolderId(visibleFolders[0]?.id ?? null);
      });
    }
  }, [activeFolderId, visibleFolders]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = location.pathname;

    if (location.pathname === previousPathname) {
      return;
    }

    const nextFolderId = routeDrivenFolderId;
    if (nextFolderId && nextFolderId !== activeFolderId) {
      queueMicrotask(() => {
        setActiveFolderId(nextFolderId);
      });
    }
  }, [activeFolderId, location.pathname, routeDrivenFolderId]);

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

    const animationFrameId = window.requestAnimationFrame(
      updateAppTabsOverflow,
    );
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
    if (!isDesktopSidebarCollapsed) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!desktopSidebarRef.current?.contains(event.target as Node)) {
        setShowCollapsedFolderFlyout(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isDesktopSidebarCollapsed]);

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
        Math.min(
          visibleFolders.length,
          Math.floor((availableWidth + MOBILE_NAV_BUTTON_GAP_PX) / slotWidth),
        ),
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
    setShowCollapsedFolderFlyout(false);
    navigate(`/app/${APP_ROUTE_SEGMENT_BY_ID[appId]}`);
  };

  const handleFolderHomeSelect = (folderId: UserFolderId) => {
    setActiveFolderId(folderId);
    setShowCollapsedFolderFlyout(false);
    navigate("/app");
  };

  const handleFolderSelect = (folderId: UserFolderId) => {
    setShowSessionMenu(false);
    if (isDesktopSidebarCollapsed) {
      setShowCollapsedFolderFlyout(
        activeFolderId === folderId ? (current) => !current : true,
      );
    }
    setActiveFolderId(folderId);
  };

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed((current) => !current);
    setShowCollapsedFolderFlyout(false);
  };

  const renderLandingPlaceholder = () => {
    return (
      <section className="space-y-2 lg:grid lg:h-full lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-2 lg:space-y-0 lg:overflow-hidden">
        <Card className="p-2 lg:col-span-8">
          <CardHeader className="mb-0">
            <CardTitle className="text-base">Today Ops</CardTitle>
            <CardDescription className="text-xs">
              Placeholder dashboard for <strong>{activeBusinessName}</strong>.
              Replace each card with live data as modules are implemented.
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
                <p className="text-[11px] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {metric.value}
                </p>
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
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/65 px-3 py-2 text-[11px] text-muted-foreground">
              Search controls will appear here when global lookup is
              implemented.
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
              <p>Sync summary placeholder for the current business.</p>
              <p>
                Current queued item count can be shown here once the shell
                status card is finalized.
              </p>
              <p>
                Current local outbox count:{" "}
                <span className="font-semibold text-foreground">
                  {pendingOutboxCount}
                </span>
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
    <main className="h-auto w-full pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:h-full lg:min-h-0 lg:pb-3">
      <div
        className={`grid w-full gap-2 lg:h-full ${isDesktopSidebarCollapsed ? "lg:grid-cols-[56px_minmax(0,1fr)]" : "lg:grid-cols-[300px_minmax(0,1fr)]"}`}
      >
        <aside
          ref={desktopSidebarRef}
          className={`relative hidden rounded-xl border border-border/75 bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex lg:h-full lg:min-h-0 ${isDesktopSidebarCollapsed ? "lg:overflow-visible" : "lg:overflow-hidden"}`}
        >
          {isDesktopSidebarCollapsed ? (
            <div className="flex h-full w-10 flex-col items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-2 h-9 w-9 shrink-0 px-0"
                onClick={toggleDesktopSidebar}
                aria-label="Expand navigation"
                title="Expand navigation"
              >
                <PanelLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto">
                {visibleFolders.map((folder) => (
                  <AppNavButton
                    key={folder.id}
                    type="button"
                    onClick={() => handleFolderSelect(folder.id)}
                    Icon={folder.Icon}
                    label={folder.label}
                    active={activeFolder?.id === folder.id}
                    iconOnly
                    aria-current={
                      activeFolder?.id === folder.id ? "page" : undefined
                    }
                  />
                ))}
              </div>
              <div className="mt-2 grid gap-1.5 border-t border-border/70 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 px-0"
                  onClick={() => {
                    void onSyncNow();
                  }}
                  disabled={isSyncing}
                  aria-label={isSyncing ? "Syncing" : "Sync"}
                  title={isSyncing ? "Syncing" : "Sync"}
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 px-0"
                  onClick={() => void onLogout()}
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              {shouldShowCollapsedFolderFlyout && activeFolder ? (
                <div className="absolute left-[3.6rem] top-2 z-30 flex w-56 max-w-[calc(100vw-7rem)] flex-col rounded-xl border border-border/80 bg-card p-2 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.28)]">
                  <div className="border-b border-border/70 px-1 pb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {activeFolder.label}
                    </p>
                    <p className="pt-0.5 text-[11px] text-muted-foreground">
                      Choose an app to continue.
                    </p>
                  </div>
                  <div className="mt-2 max-h-[min(60vh,32rem)] overflow-y-auto overflow-x-hidden">
                    <div className="space-y-1.5">
                      {activeFolderNavEntries.map((entry) => (
                        <AppTabButton
                          key={entry.key}
                          type="button"
                          onClick={() => {
                            if (entry.isHome && activeFolder) {
                              handleFolderHomeSelect(activeFolder.id);
                              return;
                            }
                            if (entry.appId) {
                              handleAppSelect(entry.appId);
                            }
                          }}
                          Icon={entry.Icon}
                          label={entry.label}
                          active={
                            entry.isHome
                              ? !routeDrivenAppId
                              : routeDrivenAppId === entry.appId
                          }
                          stacked
                          className="border-border/60 bg-transparent shadow-none hover:bg-card/55"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid h-full min-h-0 w-full grid-cols-[132px_minmax(0,1fr)] gap-2">
              <div className="min-h-0 border-r border-border/70 pr-2">
                <div className="flex items-center justify-between px-1 pb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Navigation
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 px-0"
                    onClick={toggleDesktopSidebar}
                    aria-label="Collapse navigation"
                    title="Collapse navigation"
                  >
                    <PanelLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {visibleFolders.map((folder) => (
                    <AppNavButton
                      key={folder.id}
                      type="button"
                      onClick={() => handleFolderSelect(folder.id)}
                      Icon={folder.Icon}
                      label={folder.label}
                      active={activeFolder?.id === folder.id}
                      aria-current={
                        activeFolder?.id === folder.id ? "page" : undefined
                      }
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
                    {activeFolderNavEntries.map((entry) => (
                      <AppTabButton
                        key={entry.key}
                        type="button"
                        onClick={() => {
                          if (entry.isHome && activeFolder) {
                            handleFolderHomeSelect(activeFolder.id);
                            return;
                          }
                          if (entry.appId) {
                            handleAppSelect(entry.appId);
                          }
                        }}
                        Icon={entry.Icon}
                        label={entry.label}
                        active={
                          entry.isHome
                            ? !routeDrivenAppId
                            : routeDrivenAppId === entry.appId
                        }
                        stacked
                        className="border-border/60 bg-transparent shadow-none hover:bg-card/55"
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
            </div>
          )}
        </aside>

        <section className="min-w-0 space-y-2 pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:pb-0 lg:flex lg:min-h-0 lg:flex-col">
          <div className="min-w-0 rounded-xl border border-border/80 bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_24px_-20px_rgba(15,23,42,0.18)] lg:hidden">
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
                {activeFolderNavEntries.map((entry) => (
                  <AppTabButton
                    key={entry.key}
                    data-app-id={entry.appId ?? entry.key}
                    type="button"
                    onClick={() => {
                      if (entry.isHome && activeFolder) {
                        handleFolderHomeSelect(activeFolder.id);
                        return;
                      }
                      if (entry.appId) {
                        handleAppSelect(entry.appId);
                      }
                    }}
                    Icon={entry.Icon}
                    label={entry.label}
                    active={
                      entry.isHome
                        ? !routeDrivenAppId
                        : routeDrivenAppId === entry.appId
                    }
                  />
                ))}
              </div>
              {showAppTabsLeftFade ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card/95 via-card/70 to-transparent" />
              ) : null}
              {showAppTabsRightFade ? (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card/95 via-card/70 to-transparent" />
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

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_2px_rgba(15,23,42,0.05)] lg:hidden">
        {showSessionMenu ? (
          <div className="absolute inset-x-2 bottom-full z-50 mb-2 rounded-lg border border-border/80 bg-card p-1 shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
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
                className="h-9 w-full justify-start gap-2 px-3 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                  aria-current={
                    activeFolder?.id === folder.id ? "page" : undefined
                  }
                />
              ))}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="flex min-h-14 min-w-[4.8rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] leading-tight text-foreground/75 hover:bg-card/80"
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
