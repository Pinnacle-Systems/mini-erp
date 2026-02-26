import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, CircleMinus, CirclePlus, Pencil, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/molecules/Card";
import { useSessionStore } from "../features/auth/session-business";
import {
  getLocalItemDetailForDisplay,
  getLocalItemsForDisplay,
  getLocalItemCategoryEntriesForStore,
  queueItemCategoryCreate,
  queueItemCategoryDelete,
  queueItemCategoryUpdate,
  queueItemUpdate,
  syncOnce,
  type ItemCategoryEntry,
  type ItemDetailDisplay,
  type ItemDisplay,
} from "../features/sync/engine";

type CategoryBucket = {
  id: string | null;
  name: string;
  items: ItemDisplay[];
};

export function CatalogCategoriesPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const isBusinessSelected = useSessionStore(
    (state) => state.isBusinessSelected,
  );
  const activeStore = useSessionStore((state) => state.activeStore);
  const [items, setItems] = useState<ItemDisplay[]>([]);
  const [entries, setEntries] = useState<ItemCategoryEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState("");
  const [pendingCreatedCategory, setPendingCreatedCategory] = useState<string | null>(null);
  const [isEditingCategoryName, setIsEditingCategoryName] = useState(false);
  const [categoryNameDraft, setCategoryNameDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);
  const [itemDetailsById, setItemDetailsById] = useState<Record<string, ItemDetailDisplay>>({});
  const [loadingDetailsById, setLoadingDetailsById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeStore) {
      setItems([]);
      setSelectedCategory(null);
      return;
    }

    let cancelled = false;
    void Promise.all([
      getLocalItemsForDisplay(activeStore),
      getLocalItemCategoryEntriesForStore(activeStore),
    ])
      .then(([nextItems, nextEntries]) => {
        if (cancelled) return;
        setItems(nextItems);
        setEntries(nextEntries);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setEntries([]);
      });

    void syncOnce(activeStore)
      .then(async () => {
        const [nextItems, nextEntries] = await Promise.all([
          getLocalItemsForDisplay(activeStore),
          getLocalItemCategoryEntriesForStore(activeStore),
        ]);
        if (cancelled) return;
        setItems(nextItems);
        setEntries(nextEntries);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  const buckets = useMemo<CategoryBucket[]>(() => {
    const map = new Map<string, { id: string | null; items: ItemDisplay[] }>();
    for (const item of items) {
      const category = item.category.trim();
      if (!category) continue;
      const current = map.get(category) ?? { id: null, items: [] };
      current.items.push(item);
      map.set(category, current);
    }

    for (const entry of entries) {
      const name = entry.name.trim();
      if (!name) continue;
      const current = map.get(name) ?? { id: entry.id, items: [] };
      current.id = current.id ?? entry.id;
      map.set(name, current);
    }

    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, bucket]) => ({
        id: bucket.id,
        name,
        items: bucket.items.sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      }));
  }, [entries, items]);

  const selectedBucket = selectedCategory
    ? buckets.find((bucket) => bucket.name === selectedCategory) ?? null
    : null;
  const activeBucket: CategoryBucket | null =
    selectedBucket ??
    (pendingCreatedCategory &&
    selectedCategory &&
    pendingCreatedCategory === selectedCategory
      ? {
          id: null,
          name: selectedCategory,
          items: [],
        }
      : buckets[0] ?? null);

  useEffect(() => {
    if (!activeBucket) {
      setSelectedCategory(null);
      return;
    }
    if (selectedCategory !== activeBucket.name) {
      setSelectedCategory(activeBucket.name);
    }
  }, [activeBucket, selectedCategory]);

  useEffect(() => {
    if (!activeBucket) {
      setIsEditingCategoryName(false);
      setCategoryNameDraft("");
      return;
    }
    setIsEditingCategoryName(false);
    setCategoryNameDraft(activeBucket.name);
  }, [activeBucket]);

  useEffect(() => {
    setExpandedItemIds([]);
    setItemDetailsById({});
    setLoadingDetailsById({});
  }, [activeBucket?.name]);

  const refresh = async () => {
    if (!activeStore) return;
    const [nextItems, nextEntries] = await Promise.all([
      getLocalItemsForDisplay(activeStore),
      getLocalItemCategoryEntriesForStore(activeStore),
    ]);
    setItems(nextItems);
    setEntries(nextEntries);
  };

  const toggleExpand = (itemId: string) => {
    const isExpanded = expandedItemIds.includes(itemId);
    if (isExpanded) {
      setExpandedItemIds((current) => current.filter((id) => id !== itemId));
      return;
    }

    setExpandedItemIds((current) => [...current, itemId]);
    if (!activeStore || itemDetailsById[itemId] || loadingDetailsById[itemId]) {
      return;
    }

    setLoadingDetailsById((current) => ({ ...current, [itemId]: true }));
    void getLocalItemDetailForDisplay(activeStore, itemId)
      .then((detail) => {
        if (!detail) return;
        setItemDetailsById((current) => ({ ...current, [itemId]: detail }));
      })
      .finally(() => {
        setLoadingDetailsById((current) => ({ ...current, [itemId]: false }));
      });
  };

  const onCreateCategory = async () => {
    if (!activeStore || !identityId || !isBusinessSelected) return;
    const name = draftCategory.trim();
    if (!name) return;
    setSelectedCategory(name);
    setPendingCreatedCategory(name);
    setLoading(true);
    setError(null);
    try {
      await queueItemCategoryCreate(activeStore, identityId, name);
      await syncOnce(activeStore);
      await refresh();
      setDraftCategory("");
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to create category right now.");
    } finally {
      setPendingCreatedCategory(null);
      setLoading(false);
    }
  };

  const onDeleteCategory = async (category: CategoryBucket) => {
    if (!activeStore || !identityId || !isBusinessSelected)
      return;
    const hasTaggedItems = category.items.length > 0;
    const confirmed = window.confirm(
      hasTaggedItems
        ? `Delete category '${category.name}'? Tagged items will become uncategorized.`
        : `Delete category '${category.name}'?`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      for (const item of category.items) {
        await queueItemUpdate(activeStore, identityId, item.entityId, {
          category: null,
        });
      }
      if (category.id) {
        await queueItemCategoryDelete(activeStore, identityId, category.id);
      }
      await syncOnce(activeStore);
      await refresh();
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to delete category right now.");
    } finally {
      setLoading(false);
    }
  };

  const onRenameCategory = async () => {
    if (!activeStore || !identityId || !isBusinessSelected || !activeBucket) return;
    const nextName = categoryNameDraft.trim();
    if (!nextName) {
      setError("Category name is required.");
      return;
    }
    if (nextName === activeBucket.name) {
      setIsEditingCategoryName(false);
      return;
    }

    const duplicateExists = buckets.some(
      (bucket) =>
        bucket.name.toLowerCase() === nextName.toLowerCase() &&
        bucket.name.toLowerCase() !== activeBucket.name.toLowerCase(),
    );
    if (duplicateExists) {
      setError("A category with that name already exists.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (activeBucket.id) {
        await queueItemCategoryUpdate(
          activeStore,
          identityId,
          activeBucket.id,
          nextName,
        );
      } else {
        for (const item of activeBucket.items) {
          await queueItemUpdate(activeStore, identityId, item.entityId, {
            category: nextName,
          });
        }
      }
      await syncOnce(activeStore);
      await refresh();
      setSelectedCategory(nextName);
      setIsEditingCategoryName(false);
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to rename category right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
      <Card className="p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5">
          <CardTitle className="text-sm">Categories</CardTitle>
          <CardDescription className="text-[11px] lg:text-[10px]">
            Organize items into category buckets for browsing and reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="space-y-1">
            <div className="flex gap-1">
              <Input
                value={draftCategory}
                onChange={(event) => setDraftCategory(event.target.value)}
                placeholder="Add category"
                className="h-8 rounded-lg px-2 text-xs"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onCreateCategory();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  void onCreateCategory();
                }}
                disabled={loading || !draftCategory.trim()}
              >
                Add
              </Button>
            </div>
            {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
          </div>

          <div className="space-y-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {buckets.map((bucket) => (
              <div
                key={bucket.name}
                className={`flex min-h-8 items-center gap-1 rounded-lg border px-1.5 py-1 text-left text-xs transition ${
                  activeBucket?.name === bucket.name
                    ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
                    : "border-border/70 bg-white/70 text-foreground/80 hover:bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCategory(bucket.name)}
                  className="flex h-6 min-w-0 flex-1 items-center justify-between"
                >
                  <span className="truncate font-medium">{bucket.name}</span>
                  <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px]">
                    {bucket.items.length}
                  </span>
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#8a2d2d] transition hover:bg-[#ffecec] disabled:opacity-50"
                  onClick={() => {
                    void onDeleteCategory(bucket);
                  }}
                  disabled={loading}
                  aria-label={`Delete category ${bucket.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5">
          {isEditingCategoryName ? (
            <div className="flex items-center gap-1">
              <Input
                value={categoryNameDraft}
                onChange={(event) => setCategoryNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onRenameCategory();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setIsEditingCategoryName(false);
                    setCategoryNameDraft(activeBucket?.name ?? "");
                  }
                }}
                className="h-8 text-sm"
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#166534] transition hover:bg-[#ecfdf3] disabled:opacity-50"
                onClick={() => {
                  void onRenameCategory();
                }}
                disabled={loading}
                aria-label="Save category name"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 transition hover:bg-white/80 disabled:opacity-50"
                onClick={() => {
                  setIsEditingCategoryName(false);
                  setCategoryNameDraft(activeBucket?.name ?? "");
                }}
                disabled={loading}
                aria-label="Cancel category rename"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm">
                {activeBucket?.name ?? "Category"}
              </CardTitle>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#2f6fb7] transition hover:bg-[#e9f2ff] disabled:opacity-50"
                onClick={() => {
                  setIsEditingCategoryName(true);
                  setCategoryNameDraft(activeBucket?.name ?? "");
                  setError(null);
                }}
                disabled={loading || !activeBucket}
                aria-label="Edit category name"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2 p-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {!activeBucket || activeBucket.items.length === 0 ? (
            <div className="rounded-lg border border-white/70 bg-white/65 px-2 py-2 text-xs text-muted-foreground">
              No items mapped to this category.
            </div>
          ) : (
            <>
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:hidden">
                {activeBucket.items.map((item) => (
                  <li
                    key={item.entityId}
                    role="button"
                    tabIndex={0}
                    className="rounded-lg border border-white/75 bg-white/70 px-2 py-1.5 text-left transition hover:bg-white"
                    onClick={() => navigate(`/app/items/${item.entityId}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/app/items/${item.entityId}`);
                      }
                    }}
                  >
                    <p className="text-xs font-semibold text-foreground">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.variantCount > 1
                        ? `Variants: ${item.variantCount}`
                        : `SKU: ${item.sku || "Not set"}`}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-hidden rounded-xl border border-white/65 bg-white/55 lg:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead className="bg-white/70 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                    <tr>
                      <th className="w-14 px-3 py-2">Open</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="w-44 px-3 py-2">Default SKU</th>
                      <th className="w-28 px-3 py-2">Variants</th>
                      <th className="w-28 px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBucket.items.map((item) => {
                      const isExpanded = expandedItemIds.includes(item.entityId);
                      const detail = itemDetailsById[item.entityId];
                      const variants = detail?.variants ?? [];
                      const isLoading = Boolean(loadingDetailsById[item.entityId]);

                      return (
                        <Fragment key={item.entityId}>
                          <tr className="border-t border-white/60 text-sm">
                            <td className="px-3 py-2 align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-[#2f6fb7] hover:bg-[#e9f2ff]"
                                onClick={() => toggleExpand(item.entityId)}
                                aria-label={isExpanded ? "Collapse variants" : "Expand variants"}
                              >
                                {isExpanded ? <CircleMinus /> : <CirclePlus />}
                              </Button>
                            </td>
                            <td className="px-3 py-2 align-middle font-medium text-foreground">
                              {item.name}
                            </td>
                            <td className="truncate px-3 py-2 align-middle text-muted-foreground">
                              {item.sku || "Not set"}
                            </td>
                            <td className="px-3 py-2 align-middle text-muted-foreground">
                              {item.variantCount}
                            </td>
                            <td className="px-3 py-2 text-right align-middle">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/app/items/${item.entityId}`)}
                              >
                                Manage
                              </Button>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="border-t border-white/40 bg-white/40 text-sm">
                              <td colSpan={5} className="px-3 py-3">
                                {isLoading ? (
                                  <p className="text-xs text-muted-foreground">Loading variants...</p>
                                ) : variants.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No variants found.</p>
                                ) : (
                                  <div className="overflow-x-auto rounded-lg border border-white/65 bg-white/70">
                                    <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
                                      <thead className="bg-white/75 text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
                                        <tr>
                                          <th className="w-20 px-2 py-1.5">Default</th>
                                          <th className="w-20 px-2 py-1.5">Active</th>
                                          <th className="px-2 py-1.5">Variant Name</th>
                                          <th className="px-2 py-1.5">SKU</th>
                                          <th className="px-2 py-1.5">Barcode</th>
                                          <th className="px-2 py-1.5">Options</th>
                                          <th className="w-20 px-2 py-1.5">Usage</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {variants.map((variant) => {
                                          const optionPairs = Object.entries(variant.optionValues);
                                          return (
                                            <tr key={variant.id} className="border-t border-white/60 text-xs">
                                              <td className="px-2 py-1.5 text-muted-foreground">
                                                {variant.isDefault ? "Yes" : "No"}
                                              </td>
                                              <td className="px-2 py-1.5 text-muted-foreground">
                                                {variant.isActive ? "Yes" : "No"}
                                              </td>
                                              <td className="truncate px-2 py-1.5">{variant.name || "-"}</td>
                                              <td className="truncate px-2 py-1.5">{variant.sku || "-"}</td>
                                              <td className="truncate px-2 py-1.5">{variant.barcode || "-"}</td>
                                              <td className="px-2 py-1.5 text-muted-foreground">
                                                {optionPairs.length === 0
                                                  ? "-"
                                                  : optionPairs
                                                      .map(([key, value]) => `${key}: ${value}`)
                                                      .join(", ")}
                                              </td>
                                              <td className="px-2 py-1.5 text-muted-foreground">
                                                {variant.usageCount}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
