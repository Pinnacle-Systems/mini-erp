import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../design-system/atoms/Button";
import { IconButton } from "../../design-system/atoms/IconButton";
import { Input } from "../../design-system/atoms/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import { ItemVariantFlatTable } from "../../design-system/organisms/ItemVariantFlatTable";
import {
  hasAssignedStoreCapability,
  useSessionStore,
} from "../../features/auth/session-business";
import {
  getLocalItemsForDisplay,
  getLocalItemCategoryEntriesForStore,
  queueItemCategoryCreate,
  queueItemCategoryDelete,
  queueItemCategoryUpdate,
  queueItemUpdate,
  syncOnce,
  type ItemCategoryEntry,
  type ItemDisplay,
} from "../../features/sync/engine";

type CategoryBucket = {
  id: string | null;
  name: string;
  items: ItemDisplay[];
};

export function CategoriesPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const businesses = useSessionStore((state) => state.businesses);
  const isBusinessSelected = useSessionStore(
    (state) => state.isBusinessSelected,
  );
  const activeStore = useSessionStore((state) => state.activeStore);
  const [items, setItems] = useState<ItemDisplay[]>([]);
  const [entries, setEntries] = useState<ItemCategoryEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState("");
  const [pendingCreatedCategory, setPendingCreatedCategory] = useState<
    string | null
  >(null);
  const [isEditingCategoryName, setIsEditingCategoryName] = useState(false);
  const [categoryNameDraft, setCategoryNameDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeStore) ?? null,
    [activeStore, businesses],
  );
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (item.itemType === "SERVICE") {
          return hasAssignedStoreCapability(activeBusiness, "ITEM_SERVICES");
        }
        return hasAssignedStoreCapability(activeBusiness, "ITEM_PRODUCTS");
      }),
    [activeBusiness, items],
  );

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
    const allCategoryNames = new Set(
      items.map((item) => item.category.trim()).filter((name) => name.length > 0),
    );
    const map = new Map<string, { id: string | null; items: ItemDisplay[] }>();
    for (const item of filteredItems) {
      const category = item.category.trim();
      if (!category) continue;
      const current = map.get(category) ?? { id: null, items: [] };
      current.items.push(item);
      map.set(category, current);
    }

    for (const entry of entries) {
      const name = entry.name.trim();
      if (!name) continue;
      if (allCategoryNames.has(name) && !map.has(name)) {
        continue;
      }
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
  }, [entries, filteredItems, items]);

  const selectedBucket = selectedCategory
    ? (buckets.find((bucket) => bucket.name === selectedCategory) ?? null)
    : null;
  const activeBucket = useMemo<CategoryBucket | null>(() => {
    if (selectedBucket) return selectedBucket;
    if (
      pendingCreatedCategory &&
      selectedCategory &&
      pendingCreatedCategory === selectedCategory
    ) {
      return {
        id: null,
        name: selectedCategory,
        items: [],
      };
    }
    return buckets[0] ?? null;
  }, [buckets, pendingCreatedCategory, selectedBucket, selectedCategory]);

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

  const refresh = async () => {
    if (!activeStore) return;
    const [nextItems, nextEntries] = await Promise.all([
      getLocalItemsForDisplay(activeStore),
      getLocalItemCategoryEntriesForStore(activeStore),
    ]);
    setItems(nextItems);
    setEntries(nextEntries);
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
    if (!activeStore || !identityId || !isBusinessSelected) return;
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
    if (!activeStore || !identityId || !isBusinessSelected || !activeBucket)
      return;
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

  const getBucketVariantCount = (bucket: CategoryBucket) =>
    bucket.items.reduce((total, item) => total + Math.max(item.variantCount, 1), 0);

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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(bucket.name)}
                  className="flex h-6 min-w-0 flex-1 items-center justify-between border-none bg-transparent px-0 text-left text-xs font-medium shadow-none hover:bg-transparent"
                >
                  <span className="truncate font-medium">{bucket.name}</span>
                  <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px]">
                    {getBucketVariantCount(bucket)}
                  </span>
                </Button>
                <IconButton
                  type="button"
                  icon={Trash2}
                  variant="ghost"
                  className="h-6 w-6 rounded-full border-none bg-transparent p-0 text-[#8a2d2d] shadow-none hover:bg-[#ffecec] disabled:opacity-50"
                  onClick={() => {
                    void onDeleteCategory(bucket);
                  }}
                  disabled={loading}
                  aria-label={`Delete category ${bucket.name}`}
                  title={`Delete category ${bucket.name}`}
                  iconSize={14}
                />
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
              <IconButton
                type="button"
                icon={Check}
                variant="ghost"
                className="h-8 w-8 rounded-full border-none bg-transparent p-0 text-[#166534] shadow-none transition hover:bg-[#ecfdf3] disabled:opacity-50"
                onClick={() => {
                  void onRenameCategory();
                }}
                disabled={loading}
                aria-label="Save category name"
                title="Save category name"
              />
              <IconButton
                type="button"
                icon={X}
                variant="ghost"
                className="h-8 w-8 rounded-full border-none bg-transparent p-0 text-foreground/70 shadow-none transition hover:bg-white/80 disabled:opacity-50"
                onClick={() => {
                  setIsEditingCategoryName(false);
                  setCategoryNameDraft(activeBucket?.name ?? "");
                }}
                disabled={loading}
                aria-label="Cancel category rename"
                title="Cancel category rename"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm">
                {activeBucket?.name ?? "Category"}
              </CardTitle>
              <IconButton
                type="button"
                icon={Pencil}
                variant="ghost"
                className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#2f6fb7] shadow-none transition hover:bg-[#e9f2ff] disabled:opacity-50"
                onClick={() => {
                  setIsEditingCategoryName(true);
                  setCategoryNameDraft(activeBucket?.name ?? "");
                  setError(null);
                }}
                disabled={loading || !activeBucket}
                aria-label="Edit category name"
                title="Edit category name"
                iconSize={14}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2 p-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {!activeBucket || activeBucket.items.length === 0 ? (
            <div className="rounded-lg border border-white/70 bg-white/65 px-2 py-2 text-xs text-muted-foreground">
              No items mapped to this category.
            </div>
          ) : (
            <ItemVariantFlatTable
              items={activeBucket.items}
              activeStore={activeStore}
              actionLabel="View"
              onOpenItem={(itemId) => {
                const item = activeBucket.items.find((entry) => entry.entityId === itemId);
                if (!item) return;
                navigate(
                  item.itemType === "PRODUCT"
                    ? `/app/products/${itemId}`
                    : `/app/services/${itemId}`,
                );
              }}
              showCategory={false}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
