import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../design-system/atoms/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import {
  TabularBody,
  TabularCell,
  TabularHeader,
  TabularRow,
  TabularSerialNumberCell,
  TabularSerialNumberHeaderCell,
  TabularSurface,
} from "../../design-system/molecules/TabularSurface";
import { withTabularSerialNumberColumn } from "../../design-system/molecules/tabularSerialNumbers";
import { useSessionStore } from "../../features/auth/session-business";
import {
  getLocalItemCategoryEntriesForStore,
  getLocalItemCollectionEntriesForStore,
  getLocalItemCollectionMembershipsForStore,
  getLocalItemPricingRowsForDisplay,
  getLocalItemsForDisplay,
  syncOnce,
  type ItemCategoryEntry,
  type ItemCollectionEntry,
  type ItemCollectionMembership,
  type ItemDisplay,
  type ItemPricingRow,
} from "../../features/sync/engine";
import { useConnectivity } from "../../hooks/useConnectivity";

type CatalogAttentionRow = {
  id: string;
  itemName: string;
  itemType: ItemDisplay["itemType"];
  category: string;
  reason: string;
  severity: "High" | "Medium" | "Low";
};

type CategorySummaryRow = {
  name: string;
  itemCount: number;
  productCount: number;
  serviceCount: number;
  inactiveCount: number;
};

type CollectionSummaryRow = {
  id: string;
  name: string;
  itemCount: number;
  variantCount: number;
  inactiveVariantCount: number;
};

const formatCurrency = (value: number | null, currency = "INR") =>
  value === null
    ? "-"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(value || 0);

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const toUserCatalogOverviewErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return "Unable to load catalog overview right now.";
  return error.message || "Unable to load catalog overview right now.";
};

const isActiveItem = (item: ItemDisplay) => item.isActive;

const getVariantCount = (item: ItemDisplay) =>
  item.pendingVariantDrafts?.length ? item.pendingVariantDrafts.length : item.variantCount;

const getCategoryName = (item: ItemDisplay) => item.category.trim() || "Uncategorized";

const buildAttentionRows = (
  items: ItemDisplay[],
  salesPricesByItemId: Map<string, ItemPricingRow[]>,
  purchasePricesByItemId: Map<string, ItemPricingRow[]>,
): CatalogAttentionRow[] => {
  const rows: CatalogAttentionRow[] = [];

  for (const item of items) {
    if (!item.isActive) {
      rows.push({
        id: `${item.entityId}:inactive`,
        itemName: item.name,
        itemType: item.itemType,
        category: getCategoryName(item),
        reason: "Inactive item",
        severity: "Low",
      });
      continue;
    }

    if (!item.sku.trim() && item.variantSkus.every((sku) => !sku.trim())) {
      rows.push({
        id: `${item.entityId}:sku`,
        itemName: item.name,
        itemType: item.itemType,
        category: getCategoryName(item),
        reason: "Missing SKU",
        severity: "Medium",
      });
    }

    if (!item.category.trim()) {
      rows.push({
        id: `${item.entityId}:category`,
        itemName: item.name,
        itemType: item.itemType,
        category: "Uncategorized",
        reason: "Missing category",
        severity: "Medium",
      });
    }

    const salesRows = salesPricesByItemId.get(item.entityId) ?? [];
    const missingSalesPrice = salesRows.length === 0 || salesRows.some((row) => row.amount === null);
    if (missingSalesPrice) {
      rows.push({
        id: `${item.entityId}:sales-price`,
        itemName: item.name,
        itemType: item.itemType,
        category: getCategoryName(item),
        reason: "Missing sales price",
        severity: "High",
      });
    }

    if (item.itemType === "PRODUCT") {
      const purchaseRows = purchasePricesByItemId.get(item.entityId) ?? [];
      const missingPurchasePrice =
        purchaseRows.length === 0 || purchaseRows.some((row) => row.amount === null);
      if (missingPurchasePrice) {
        rows.push({
          id: `${item.entityId}:purchase-price`,
          itemName: item.name,
          itemType: item.itemType,
          category: getCategoryName(item),
          reason: "Missing purchase price",
          severity: "High",
        });
      }
    }
  }

  const severityOrder = { High: 0, Medium: 1, Low: 2 } satisfies Record<
    CatalogAttentionRow["severity"],
    number
  >;
  return rows.sort((left, right) => {
    const severityCompare = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityCompare !== 0) return severityCompare;
    return left.itemName.localeCompare(right.itemName);
  });
};

export function OverviewPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [items, setItems] = useState<ItemDisplay[]>([]);
  const [categories, setCategories] = useState<ItemCategoryEntry[]>([]);
  const [collections, setCollections] = useState<ItemCollectionEntry[]>([]);
  const [memberships, setMemberships] = useState<ItemCollectionMembership[]>([]);
  const [salesPricingRows, setSalesPricingRows] = useState<ItemPricingRow[]>([]);
  const [purchasePricingRows, setPurchasePricingRows] = useState<ItemPricingRow[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOnline, classifyError } = useConnectivity();

  const loadLocalData = useCallback(async (tenantId: string) => {
    const [
      nextItems,
      nextCategories,
      nextCollections,
      nextMemberships,
      nextSalesPricingRows,
      nextPurchasePricingRows,
    ] = await Promise.all([
      getLocalItemsForDisplay(tenantId),
      getLocalItemCategoryEntriesForStore(tenantId),
      getLocalItemCollectionEntriesForStore(tenantId),
      getLocalItemCollectionMembershipsForStore(tenantId),
      getLocalItemPricingRowsForDisplay(tenantId, undefined, true, "SALES"),
      getLocalItemPricingRowsForDisplay(tenantId, undefined, true, "PURCHASE"),
    ]);
    setItems(nextItems);
    setCategories(nextCategories);
    setCollections(nextCollections);
    setMemberships(nextMemberships);
    setSalesPricingRows(nextSalesPricingRows);
    setPurchasePricingRows(nextPurchasePricingRows);
  }, []);

  const load = useCallback(async () => {
    if (!activeStore || !isBusinessSelected) return;

    setLoading(true);
    try {
      await loadLocalData(activeStore);
      if (isOnline) {
        await syncOnce(activeStore);
        await loadLocalData(activeStore);
      }
      setLastUpdatedAt(new Date().toISOString());
      setError(null);
    } catch (nextError) {
      console.error(nextError);
      setError(
        classifyError(nextError).isConnectivityError
          ? "Showing local catalog data. Fresh sync will resume when the connection recovers."
          : toUserCatalogOverviewErrorMessage(nextError),
      );
    } finally {
      setLoading(false);
    }
  }, [activeStore, classifyError, isBusinessSelected, isOnline, loadLocalData]);

  useEffect(() => {
    void load();
  }, [load]);

  const overview = useMemo(() => {
    const activeItems = items.filter(isActiveItem);
    const productItems = activeItems.filter((item) => item.itemType === "PRODUCT");
    const serviceItems = activeItems.filter((item) => item.itemType === "SERVICE");
    const inactiveItems = items.filter((item) => !item.isActive);
    const activeVariantCount = activeItems.reduce((sum, item) => sum + getVariantCount(item), 0);
    const salesPricesByItemId = salesPricingRows.reduce<Map<string, ItemPricingRow[]>>(
      (acc, row) => {
        acc.set(row.itemId, [...(acc.get(row.itemId) ?? []), row]);
        return acc;
      },
      new Map(),
    );
    const purchasePricesByItemId = purchasePricingRows.reduce<Map<string, ItemPricingRow[]>>(
      (acc, row) => {
        acc.set(row.itemId, [...(acc.get(row.itemId) ?? []), row]);
        return acc;
      },
      new Map(),
    );
    const attentionRows = buildAttentionRows(items, salesPricesByItemId, purchasePricesByItemId);

    const categoryRows = Array.from(
      items.reduce<Map<string, CategorySummaryRow>>((acc, item) => {
        const name = getCategoryName(item);
        const current = acc.get(name) ?? {
          name,
          itemCount: 0,
          productCount: 0,
          serviceCount: 0,
          inactiveCount: 0,
        };
        current.itemCount += 1;
        if (item.itemType === "PRODUCT") current.productCount += 1;
        if (item.itemType === "SERVICE") current.serviceCount += 1;
        if (!item.isActive) current.inactiveCount += 1;
        acc.set(name, current);
        return acc;
      }, new Map()).values(),
    ).sort((left, right) => right.itemCount - left.itemCount || left.name.localeCompare(right.name));

    const itemIdsByCollectionId = memberships.reduce<Map<string, Set<string>>>((acc, membership) => {
      const current = acc.get(membership.collectionId) ?? new Set<string>();
      current.add(membership.itemId);
      acc.set(membership.collectionId, current);
      return acc;
    }, new Map());
    const variantCountsByCollectionId = memberships.reduce<Map<string, number>>((acc, membership) => {
      acc.set(membership.collectionId, (acc.get(membership.collectionId) ?? 0) + 1);
      return acc;
    }, new Map());
    const inactiveVariantCountsByCollectionId = memberships.reduce<Map<string, number>>(
      (acc, membership) => {
        if (membership.variantIsActive === false) {
          acc.set(membership.collectionId, (acc.get(membership.collectionId) ?? 0) + 1);
        }
        return acc;
      },
      new Map(),
    );
    const collectionRows: CollectionSummaryRow[] = collections
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        itemCount: itemIdsByCollectionId.get(collection.id)?.size ?? 0,
        variantCount: variantCountsByCollectionId.get(collection.id) ?? 0,
        inactiveVariantCount: inactiveVariantCountsByCollectionId.get(collection.id) ?? 0,
      }))
      .sort((left, right) => right.variantCount - left.variantCount || left.name.localeCompare(right.name));

    const recentlyPricedRows = [...salesPricingRows, ...purchasePricingRows]
      .filter((row) => row.updatedAt || row.pending)
      .sort((left, right) => {
        if (left.pending !== right.pending) return left.pending ? -1 : 1;
        return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
      })
      .slice(0, 8);

    return {
      activeItems,
      productItems,
      serviceItems,
      inactiveItems,
      activeVariantCount,
      attentionRows,
      categoryRows,
      collectionRows,
      recentlyPricedRows,
      categoryCount: new Set([
        ...categories.map((category) => category.name),
        ...categoryRows.map((category) => category.name),
      ]).size,
    };
  }, [categories, collections, items, memberships, purchasePricingRows, salesPricingRows]);

  const metrics = [
    { label: "Active Items", value: overview.activeItems.length },
    { label: "Products", value: overview.productItems.length },
    { label: "Services", value: overview.serviceItems.length },
    { label: "Active Variants", value: overview.activeVariantCount },
    { label: "Categories", value: overview.categoryCount },
    { label: "Needs Attention", value: overview.attentionRows.length },
  ];

  const attentionGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1.35fr) minmax(0,0.7fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,0.65fr)",
  );
  const priceGridTemplate = withTabularSerialNumberColumn(
    "minmax(0,1.25fr) minmax(0,1fr) minmax(0,0.85fr) minmax(0,0.75fr) minmax(0,0.95fr)",
  );

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 lg:overflow-hidden">
      <Card className="p-2">
        <CardHeader className="pb-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <CardTitle>Catalog Overview</CardTitle>
              <CardDescription>
                Monitor catalog completeness, categories, collections, and pricing coverage.
                {lastUpdatedAt ? (
                  <span className="ml-2 border-l border-border/80 pl-2 text-[10px]">
                    Last updated: {formatDateTime(lastUpdatedAt)}
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              disabled={!activeStore || !isBusinessSelected || loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 rounded-lg border border-border/80 bg-muted/55 px-2.5 py-2"
            >
              <p className="truncate text-[10px] text-muted-foreground">{metric.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{metric.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2 text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <p className="text-xs">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-2">
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Needs Attention</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              <div className="space-y-2 lg:hidden">
                {overview.attentionRows.length === 0 && !loading ? (
                  <p className="p-2 text-xs text-muted-foreground">No catalog items need attention.</p>
                ) : null}
                {overview.attentionRows.slice(0, 10).map((row) => (
                  <div key={row.id} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.itemName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.itemType} - {row.category}
                        </p>
                      </div>
                      <p className="text-[11px] font-semibold text-destructive">{row.severity}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{row.reason}</p>
                  </div>
                ))}
              </div>
              <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
                  <TabularHeader>
                    <TabularRow columns={attentionGridTemplate}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Item</TabularCell>
                      <TabularCell variant="header">Type</TabularCell>
                      <TabularCell variant="header">Category</TabularCell>
                      <TabularCell variant="header">Reason</TabularCell>
                      <TabularCell variant="header">Severity</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {overview.attentionRows.length === 0 && !loading ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No catalog items need attention.
                      </div>
                    ) : null}
                    {overview.attentionRows.slice(0, 10).map((row, index) => (
                      <TabularRow key={row.id} columns={attentionGridTemplate} interactive>
                        <TabularSerialNumberCell index={index} />
                        <TabularCell truncate hoverTitle={row.itemName}>
                          {row.itemName}
                        </TabularCell>
                        <TabularCell>{row.itemType === "PRODUCT" ? "Product" : "Service"}</TabularCell>
                        <TabularCell truncate hoverTitle={row.category}>
                          {row.category}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.reason}>
                          {row.reason}
                        </TabularCell>
                        <TabularCell className={row.severity === "High" ? "font-semibold text-destructive" : undefined}>
                          {row.severity}
                        </TabularCell>
                      </TabularRow>
                    ))}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Pricing Updates</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
              <div className="space-y-2 lg:hidden">
                {overview.recentlyPricedRows.length === 0 && !loading ? (
                  <p className="p-2 text-xs text-muted-foreground">No recent pricing updates.</p>
                ) : null}
                {overview.recentlyPricedRows.map((row) => (
                  <div key={`${row.priceType}:${row.variantId}`} className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.itemName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.variantName || "Default variant"} - {row.priceType}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(row.amount, row.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <TabularSurface className="min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
                  <TabularHeader>
                    <TabularRow columns={priceGridTemplate}>
                      <TabularSerialNumberHeaderCell />
                      <TabularCell variant="header">Item</TabularCell>
                      <TabularCell variant="header">Variant</TabularCell>
                      <TabularCell variant="header">Price Type</TabularCell>
                      <TabularCell variant="header" align="end">
                        Amount
                      </TabularCell>
                      <TabularCell variant="header">Updated</TabularCell>
                    </TabularRow>
                  </TabularHeader>
                  <TabularBody className="overflow-y-auto">
                    {overview.recentlyPricedRows.length === 0 && !loading ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No recent pricing updates.
                      </div>
                    ) : null}
                    {overview.recentlyPricedRows.map((row, index) => (
                      <TabularRow key={`${row.priceType}:${row.variantId}`} columns={priceGridTemplate} interactive>
                        <TabularSerialNumberCell index={index} />
                        <TabularCell truncate hoverTitle={row.itemName}>
                          {row.itemName}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.variantName || "Default variant"}>
                          {row.variantName || "Default variant"}
                        </TabularCell>
                        <TabularCell>{row.priceType === "SALES" ? "Sales" : "Purchase"}</TabularCell>
                        <TabularCell align="end" className="font-semibold text-foreground">
                          {formatCurrency(row.amount, row.currency)}
                        </TabularCell>
                        <TabularCell truncate hoverTitle={row.pending ? "Pending sync" : formatDateTime(row.updatedAt)}>
                          {row.pending ? "Pending sync" : formatDateTime(row.updatedAt)}
                        </TabularCell>
                      </TabularRow>
                    ))}
                  </TabularBody>
                </TabularSurface>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-2">
          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Category Coverage</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 space-y-2 overflow-y-auto">
              {overview.categoryRows.length === 0 && !loading ? (
                <p className="p-2 text-xs text-muted-foreground">No catalog categories yet.</p>
              ) : null}
              {overview.categoryRows.slice(0, 8).map((row) => (
                <div
                  key={row.name}
                  className="rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
                    <span className="font-semibold text-foreground">{row.itemCount}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{row.productCount} products</span>
                    <span>{row.serviceCount} services</span>
                    <span>{row.inactiveCount} inactive</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="min-h-0 p-2 lg:flex lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Collections</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 space-y-2 overflow-y-auto">
              {overview.collectionRows.length === 0 && !loading ? (
                <p className="p-2 text-xs text-muted-foreground">No item collections yet.</p>
              ) : null}
              {overview.collectionRows.slice(0, 8).map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-border/80 bg-muted/55 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
                    <span className="font-semibold text-foreground">{row.variantCount}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>{row.itemCount} items</span>
                    <span>{row.variantCount} variants</span>
                    <span>{row.inactiveVariantCount} inactive</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
