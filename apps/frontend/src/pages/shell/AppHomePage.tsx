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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSessionStore, type BusinessModules } from "../../features/auth/session-business";
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
  | "catalog-items"
  | "catalog-pricing"
  | "catalog-categories"
  | "catalog-collections"
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
type RoutableAppId = Exclude<UserAppId, "catalog-items">;

type UserFolderApp = {
  id: UserAppId;
  label: string;
  Icon: LucideIcon;
};

const APP_ROUTE_SEGMENT_BY_ID: Record<RoutableAppId, string> = {
  "sales-bills": "sales-bills",
  "sales-orders": "sales-orders",
  "sales-returns": "sales-returns",
  "catalog-pricing": "item-pricing",
  "catalog-categories": "item-categories",
  "catalog-collections": "item-collections",
  "stock-sync": "item-sync",
  "stock-levels": "stock-levels",
  "stock-adjustments": "stock-adjustments",
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
      {
        id: "catalog-collections",
        label: "Collections",
        Icon: PackageSearch,
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
  const activeBusinessName = useMemo(
    () =>
      businesses.find((business) => business.id === activeStore)?.name ??
      "No business selected",
    [activeStore, businesses],
  );
  const [activeFolderId, setActiveFolderId] = useState<UserFolderId | null>(null);
  const [pendingFolderId, setPendingFolderId] = useState<UserFolderId | null>(null);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const appTabsScrollRef = useRef<HTMLDivElement | null>(null);
  const [showAppTabsLeftFade, setShowAppTabsLeftFade] = useState(false);
  const [showAppTabsRightFade, setShowAppTabsRightFade] = useState(false);
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

  const isItemsRoute = location.pathname.startsWith("/app/items");
  const routeDrivenAppId: UserAppId | null = useMemo(() => {
    if (isItemsRoute) return "catalog-items";
    if (!location.pathname.startsWith("/app/")) return null;
    const appSegment = location.pathname.slice("/app/".length).split("/")[0] ?? "";
    if (!appSegment) return null;
    return APP_ID_BY_ROUTE_SEGMENT[appSegment] ?? null;
  }, [isItemsRoute, location.pathname]);

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
    if (isItemsRoute || routeDrivenAppId) return;
    queueMicrotask(() => {
      setActiveFolderId(pendingFolderId);
      setPendingFolderId(null);
    });
  }, [isItemsRoute, pendingFolderId, routeDrivenAppId]);

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
    if (appId === "catalog-items") {
      navigate("/app/items");
      return;
    }
    navigate(`/app/${APP_ROUTE_SEGMENT_BY_ID[appId]}`);
  };

  const handleFolderSelect = (folderId: UserFolderId) => {
    if (isItemsRoute || routeDrivenAppId) {
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
              {landingQuickActions.map((action) => (
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
                Dummy operational alerts.
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
                Dummy recent activity feed.
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
                  Ready
                </span>
              </p>
              <p>Last successful sync: 09:42 AM (dummy)</p>
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
      <div className="grid w-full gap-2 lg:h-full lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border border-white/70 bg-white/60 p-2 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl lg:block lg:h-full lg:overflow-y-auto">
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
        </aside>

        <section className="min-w-0 space-y-2 lg:flex lg:min-h-0 lg:flex-col">
          <div className="min-w-0 rounded-2xl border border-white/70 bg-white/60 p-2 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl">
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
              <section className="h-auto min-h-0 lg:h-full lg:overflow-hidden">
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

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/90 p-2 backdrop-blur-xl lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {visibleFolders.map((folder) => (
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
      </nav>
    </main>
  );
}
