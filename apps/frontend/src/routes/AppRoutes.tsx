import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useSessionStore } from "../features/auth/session-business";
import { useLogoutFlow } from "../features/auth/useLogoutFlow";
import { LoginPage } from "../pages/auth";
import { AppHomePage } from "../pages/shell";
import { AdminLayout } from "../pages/admin/layout";
import { AdminBusinessesPage, AdminBusinessDetailsPage } from "../pages/admin/businesses";
import { AdminUsersPage, AdminUserDetailsPage } from "../pages/admin/users";
import { CategoriesPage, CollectionsPage } from "../pages/catalog";
import { ItemsPage, AddItemPage, ItemDetailsPage } from "../pages/catalog/items";
import {
  AddCustomerPage,
  AddSupplierPage,
  CustomerDetailsPage,
  CustomerGroupsPage,
  CustomersPage,
  SupplierDetailsPage,
  SuppliersPage,
} from "../pages/people";
import { AppFeaturePlaceholderPage, DataSyncAppPage, ItemSyncAppPage } from "../pages/shell/UserAppPages";
import { AdjustmentsPage, HistoryPage, LevelsPage } from "../pages/stock";
import { AccountsPage, ExpensesPage, OverviewPage, PaymentsPage } from "../pages/finance";
import { OfflinePage } from "../pages/system";
import {
  BillsPage,
  DeliveryChallansPage,
  EstimatesPage,
  OrdersPage,
  PosPage,
  ReturnsPage,
} from "../pages/sales";
import {
  GoodsReceiptNotesPage,
  PurchaseInvoicesPage,
  PurchaseOrdersPage,
  PurchaseReturnsPage,
} from "../pages/purchases";
import { SessionHeader } from "../design-system/organisms/SessionHeader";
import {
  RequireAuth,
  RequireAnyCapability,
  RequireCapability,
  RequireHydrated,
  RequireModule,
  RequireRole,
} from "./guards";

function AppEntryRoute() {
  const role = useSessionStore((state) => state.role);

  if (role === "PLATFORM_ADMIN") return <Navigate to="/app/businesses" replace />;
  return <AppHomePage />;
}

function AppLayout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);

  const isAuthenticated = Boolean(identityId);
  const isPlatformAdmin = role === "PLATFORM_ADMIN";
  const shouldShowUserBack =
    !isPlatformAdmin &&
    (/^\/app\/products\/new$/.test(location.pathname) ||
      /^\/app\/products\/[^/]+$/.test(location.pathname) ||
      /^\/app\/services\/new$/.test(location.pathname) ||
      /^\/app\/services\/[^/]+$/.test(location.pathname) ||
      /^\/app\/customers\/new$/.test(location.pathname) ||
      /^\/app\/customers\/[^/]+$/.test(location.pathname) ||
      /^\/app\/suppliers\/new$/.test(location.pathname) ||
      /^\/app\/suppliers\/[^/]+$/.test(location.pathname) ||
      /^\/app\/purchase-orders\/new$/.test(location.pathname) ||
      /^\/app\/purchase-orders\/[^/]+$/.test(location.pathname) ||
      /^\/app\/goods-receipt-notes\/new$/.test(location.pathname) ||
      /^\/app\/goods-receipt-notes\/[^/]+$/.test(location.pathname) ||
      /^\/app\/purchase-invoices\/new$/.test(location.pathname) ||
      /^\/app\/purchase-invoices\/[^/]+$/.test(location.pathname) ||
      /^\/app\/purchase-returns\/new$/.test(location.pathname) ||
      /^\/app\/purchase-returns\/[^/]+$/.test(location.pathname));
  const headerContext = (() => {
    if (!isPlatformAdmin) return null;
    const { pathname } = location;
    if (pathname === "/app/businesses") {
      return {
        title: "Manage Businesses",
        subtitle: "Browse, edit, and manage business records.",
      };
    }
    if (pathname === "/app/businesses/new") {
      return {
        title: "Add Business",
        subtitle: "Create a new business and initialize profile details.",
      };
    }
    if (pathname.startsWith("/app/businesses/")) {
      return {
        title: "Business Details",
        subtitle: "Manage business metadata and lifecycle state.",
      };
    }
    if (pathname === "/app/users") {
      return {
        title: "Manage Users",
        subtitle: "Review users and inspect account activity.",
      };
    }
    if (pathname.startsWith("/app/users/")) {
      return {
        title: "User Details",
        subtitle: "Inspect user profile data and account state.",
      };
    }
    return null;
  })();

  useEffect(() => {
    if (!isAuthenticated) {
      document.body.classList.remove("app-shell-locked");
      return;
    }

    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const applyLock = () => {
      if (desktopMedia.matches) {
        document.body.classList.add("app-shell-locked");
      } else {
        document.body.classList.remove("app-shell-locked");
      }
    };

    applyLock();
    desktopMedia.addEventListener("change", applyLock);

    return () => {
      desktopMedia.removeEventListener("change", applyLock);
      document.body.classList.remove("app-shell-locked");
    };
  }, [isAuthenticated]);

  return (
    <div className="min-h-[100dvh] w-full lg:h-screen lg:overflow-hidden">
      {isAuthenticated ? (
        <div className="fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/84 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="px-2 py-2 sm:px-3 md:px-4">
            <SessionHeader
              showBack={shouldShowUserBack}
              showSwitchStore
              contextTitle={headerContext?.title}
              contextSubtitle={headerContext?.subtitle}
              onLogout={isPlatformAdmin ? onLogout : undefined}
            />
          </div>
        </div>
      ) : null}
      <div
        className={`overflow-visible overflow-x-hidden lg:h-full lg:min-h-0 lg:overflow-hidden ${isAuthenticated ? "pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:pt-[calc(4rem+env(safe-area-inset-top,0px))]" : ""}`}
      >
        <Outlet />
      </div>
    </div>
  );
}

export function AppRoutes() {
  const identityId = useSessionStore((state) => state.identityId);
  const role = useSessionStore((state) => state.role);
  const isHydratingSession = useSessionStore((state) => state.isHydratingSession);
  const { submit: onLogout } = useLogoutFlow();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const isAuthenticated = Boolean(identityId);

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

  const shouldShowOfflinePage =
    !isHydratingSession && !isOnline && (role === "PLATFORM_ADMIN" || !isAuthenticated);

  if (shouldShowOfflinePage) return <OfflinePage />;

  return (
    <Routes>
      <Route element={<RequireHydrated />}>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/app" replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout onLogout={() => void onLogout()} />}>
            <Route path="/app" element={<AppEntryRoute />}>
              <Route element={<RequireRole role="USER" />}>
                <Route element={<RequireModule moduleKey="accounts" />}>
                  <Route element={<RequireAnyCapability capabilities={["FINANCE_RECEIVABLES", "FINANCE_PAYABLES"]} />}>
                    <Route path="finance-overview" element={<OverviewPage />} />
                    <Route path="financial-accounts" element={<AccountsPage />} />
                  </Route>
                  <Route element={<RequireCapability capability="FINANCE_RECEIVABLES" />}>
                    <Route path="payments-received" element={<PaymentsPage flow="RECEIVABLE" />} />
                  </Route>
                  <Route element={<RequireCapability capability="FINANCE_PAYABLES" />}>
                    <Route path="payments-made" element={<PaymentsPage flow="PAYABLE" />} />
                    <Route path="expenses" element={<ExpensesPage />} />
                  </Route>
                </Route>
                <Route element={<RequireModule moduleKey="sales" />}>
                  <Route
                    element={
                      <RequireAnyCapability
                        capabilities={["ITEM_PRODUCTS", "ITEM_SERVICES"]}
                      />
                    }
                  >
                      <Route element={<RequireCapability capability="PARTIES_CUSTOMERS" />}>
                      <Route element={<RequireCapability capability="TXN_SALE_CREATE" />}>
                        <Route path="sales-estimates" element={<EstimatesPage />} />
                        <Route path="sales-pos" element={<PosPage />} />
                        <Route path="sales-bills" element={<BillsPage />} />
                        <Route path="sales-orders" element={<OrdersPage />} />
                        <Route path="delivery-challans" element={<DeliveryChallansPage />} />
                      </Route>
                    </Route>
                  </Route>
                  <Route element={<RequireCapability capability="PARTIES_CUSTOMERS" />}>
                    <Route element={<RequireCapability capability="TXN_SALE_RETURN" />}>
                      <Route path="sales-returns" element={<ReturnsPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route element={<RequireModule moduleKey="purchases" />}>
                  <Route element={<RequireCapability capability="PARTIES_SUPPLIERS" />}>
                    <Route element={<RequireCapability capability="TXN_PURCHASE_CREATE" />}>
                      <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
                      <Route path="purchase-orders/new" element={<PurchaseOrdersPage />} />
                      <Route path="purchase-orders/:documentId" element={<PurchaseOrdersPage />} />
                      <Route path="goods-receipt-notes" element={<GoodsReceiptNotesPage />} />
                      <Route path="goods-receipt-notes/new" element={<GoodsReceiptNotesPage />} />
                      <Route
                        path="goods-receipt-notes/:documentId"
                        element={<GoodsReceiptNotesPage />}
                      />
                      <Route path="purchase-invoices" element={<PurchaseInvoicesPage />} />
                      <Route path="purchase-invoices/new" element={<PurchaseInvoicesPage />} />
                      <Route
                        path="purchase-invoices/:documentId"
                        element={<PurchaseInvoicesPage />}
                      />
                    </Route>
                    <Route element={<RequireCapability capability="TXN_PURCHASE_RETURN" />}>
                      <Route path="purchase-returns" element={<PurchaseReturnsPage />} />
                      <Route path="purchase-returns/new" element={<PurchaseReturnsPage />} />
                      <Route
                        path="purchase-returns/:documentId"
                        element={<PurchaseReturnsPage />}
                      />
                    </Route>
                  </Route>
                </Route>
                <Route element={<RequireCapability capability="ITEM_PRODUCTS" />}>
                  <Route
                    path="products"
                    element={
                      <ItemsPage
                        itemType="PRODUCT"
                        title="Products"
                        singularLabel="Product"
                        routeBasePath="/app/products"
                      />
                    }
                  />
                  <Route
                    path="products/new"
                    element={
                      <AddItemPage
                        itemType="PRODUCT"
                        title="Products"
                        singularLabel="Product"
                        routeBasePath="/app/products"
                      />
                    }
                  />
                  <Route
                    path="products/:itemId"
                    element={
                      <ItemDetailsPage
                        itemType="PRODUCT"
                        title="Product"
                        singularLabel="Product"
                        routeBasePath="/app/products"
                      />
                    }
                  />
                </Route>
                <Route element={<RequireCapability capability="ITEM_SERVICES" />}>
                  <Route
                    path="services"
                    element={
                      <ItemsPage
                        itemType="SERVICE"
                        title="Services"
                        singularLabel="Service"
                        routeBasePath="/app/services"
                      />
                    }
                  />
                  <Route
                    path="services/new"
                    element={
                      <AddItemPage
                        itemType="SERVICE"
                        title="Services"
                        singularLabel="Service"
                        routeBasePath="/app/services"
                      />
                    }
                  />
                  <Route
                    path="services/:itemId"
                    element={
                      <ItemDetailsPage
                        itemType="SERVICE"
                        title="Service"
                        singularLabel="Service"
                        routeBasePath="/app/services"
                      />
                    }
                  />
                </Route>
                <Route
                  element={
                    <RequireAnyCapability capabilities={["ITEM_PRODUCTS", "ITEM_SERVICES"]} />
                  }
                >
                  <Route path="item-categories" element={<CategoriesPage />} />
                  <Route path="item-collections" element={<CollectionsPage />} />
                  <Route path="item-sync" element={<Navigate to="/app/admin-item-sync" replace />} />
                  <Route path="admin-item-sync" element={<ItemSyncAppPage />} />
                </Route>
                <Route path="stock-levels" element={<LevelsPage />} />
                <Route path="stock-adjustments" element={<AdjustmentsPage />} />
                <Route path="stock-history" element={<HistoryPage />} />
                <Route element={<RequireCapability capability="PARTIES_CUSTOMERS" />}>
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="customers/new" element={<AddCustomerPage />} />
                  <Route path="customers/:customerId" element={<CustomerDetailsPage />} />
                </Route>
                <Route element={<RequireCapability capability="PARTIES_CUSTOMERS" />}>
                  <Route path="customer-groups" element={<CustomerGroupsPage />} />
                </Route>
                <Route element={<RequireCapability capability="PARTIES_SUPPLIERS" />}>
                  <Route path="suppliers" element={<SuppliersPage />} />
                  <Route path="suppliers/new" element={<AddSupplierPage />} />
                  <Route path="suppliers/:supplierId" element={<SupplierDetailsPage />} />
                </Route>
                <Route path="promo-rules" element={<AppFeaturePlaceholderPage sectionTitle="Promotions" appLabel="Rules" />} />
                <Route path="promo-bundles" element={<AppFeaturePlaceholderPage sectionTitle="Promotions" appLabel="Bundles" />} />
                <Route path="promo-codes" element={<AppFeaturePlaceholderPage sectionTitle="Promotions" appLabel="Codes" />} />
                <Route path="sales-report" element={<AppFeaturePlaceholderPage sectionTitle="Reports" appLabel="Sales" />} />
                <Route path="top-items-report" element={<AppFeaturePlaceholderPage sectionTitle="Reports" appLabel="Top Items" />} />
                <Route path="stock-value-report" element={<AppFeaturePlaceholderPage sectionTitle="Reports" appLabel="Stock Value" />} />
                <Route path="settings" element={<AppFeaturePlaceholderPage sectionTitle="Admin" appLabel="Business Settings" />} />
                <Route path="data-sync" element={<DataSyncAppPage />} />
              </Route>
            </Route>

            <Route element={<RequireRole role="PLATFORM_ADMIN" />}>
              <Route element={<AdminLayout />}>
                <Route path="/app/businesses" element={<AdminBusinessesPage mode="list" />} />
                <Route path="/app/businesses/new" element={<AdminBusinessesPage mode="new" />} />
                <Route path="/app/businesses/:businessId" element={<AdminBusinessDetailsPage />} />
                <Route path="/app/users" element={<AdminUsersPage />} />
                <Route path="/app/users/:userId" element={<AdminUserDetailsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/app" : "/login"} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/app" : "/login"} replace />}
        />
      </Route>
    </Routes>
  );
}
