import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Search, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";
import { useSessionStore } from "../features/auth/session-business";
import {
  getLocalItemCollectionEntriesForStore,
  getLocalItemCollectionMembershipsForStore,
  getLocalItemDetailForDisplay,
  getLocalItemsForDisplay,
  queueItemCollectionCreate,
  queueItemCollectionDelete,
  queueItemCollectionMembershipCreate,
  queueItemCollectionMembershipDelete,
  queueItemCollectionUpdate,
  syncOnce,
  type ItemCollectionEntry,
  type ItemCollectionMembership,
  type ItemDetailDisplay,
  type ItemDisplay,
} from "../features/sync/engine";

type CollectionVariantLink = {
  membershipId: string;
  variantId: string;
};

type CollectionItemGroup = {
  item: ItemDisplay;
  links: CollectionVariantLink[];
};

type CollectionBucket = {
  id: string;
  name: string;
  items: CollectionItemGroup[];
};

type CollectionVariantRow = {
  membershipId: string;
  itemId: string;
  itemName: string;
  variantId: string;
  variantName: string;
  sku: string;
  isDefault: boolean;
  isActive: boolean;
};

export function CatalogCollectionsPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const activeStore = useSessionStore((state) => state.activeStore);
  const [items, setItems] = useState<ItemDisplay[]>([]);
  const [collections, setCollections] = useState<ItemCollectionEntry[]>([]);
  const [memberships, setMemberships] = useState<ItemCollectionMembership[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [draftCollectionName, setDraftCollectionName] = useState("");
  const [isEditingCollectionName, setIsEditingCollectionName] = useState(false);
  const [collectionNameDraft, setCollectionNameDraft] = useState("");
  const [itemSearchDraft, setItemSearchDraft] = useState("");
  const [itemDetailsById, setItemDetailsById] = useState<Record<string, ItemDetailDisplay>>({});
  const [loadingDetailsById, setLoadingDetailsById] = useState<Record<string, boolean>>({});
  const [variantPickerItemId, setVariantPickerItemId] = useState<string | null>(null);
  const [variantSelectionsByItemId, setVariantSelectionsByItemId] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!activeStore) return;
    const [nextItems, nextCollections, nextMemberships] = await Promise.all([
      getLocalItemsForDisplay(activeStore),
      getLocalItemCollectionEntriesForStore(activeStore),
      getLocalItemCollectionMembershipsForStore(activeStore),
    ]);
    setItems(nextItems);
    setCollections(nextCollections);
    setMemberships(nextMemberships);
  };

  useEffect(() => {
    if (!activeStore) {
      setItems([]);
      setCollections([]);
      setMemberships([]);
      setSelectedCollectionId(null);
      return;
    }

    let cancelled = false;
    void Promise.all([
      getLocalItemsForDisplay(activeStore),
      getLocalItemCollectionEntriesForStore(activeStore),
      getLocalItemCollectionMembershipsForStore(activeStore),
    ])
      .then(([nextItems, nextCollections, nextMemberships]) => {
        if (cancelled) return;
        setItems(nextItems);
        setCollections(nextCollections);
        setMemberships(nextMemberships);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setCollections([]);
        setMemberships([]);
      });

    void syncOnce(activeStore)
      .then(async () => {
        const [nextItems, nextCollections, nextMemberships] = await Promise.all([
          getLocalItemsForDisplay(activeStore),
          getLocalItemCollectionEntriesForStore(activeStore),
          getLocalItemCollectionMembershipsForStore(activeStore),
        ]);
        if (cancelled) return;
        setItems(nextItems);
        setCollections(nextCollections);
        setMemberships(nextMemberships);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  const buckets = useMemo<CollectionBucket[]>(() => {
    const itemById = new Map(items.map((item) => [item.entityId, item]));
    const linksByCollectionId = memberships.reduce<Record<string, CollectionItemGroup[]>>(
      (acc, membership) => {
        const item = itemById.get(membership.itemId);
        if (!item) return acc;
        const existing = acc[membership.collectionId] ?? [];
        const group = existing.find((entry) => entry.item.entityId === item.entityId);
        if (group) {
          group.links.push({ membershipId: membership.id, variantId: membership.variantId });
        } else {
          existing.push({
            item,
            links: [{ membershipId: membership.id, variantId: membership.variantId }],
          });
        }
        acc[membership.collectionId] = existing;
        return acc;
      },
      {},
    );

    return collections
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        items: (linksByCollectionId[collection.id] ?? []).sort((left, right) =>
          left.item.name.localeCompare(right.item.name),
        ),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [collections, items, memberships]);

  const activeBucket =
    buckets.find((bucket) => bucket.id === selectedCollectionId) ?? buckets[0] ?? null;

  const activeVariantIdsByItemId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const group of activeBucket?.items ?? []) {
      map.set(
        group.item.entityId,
        new Set(group.links.map((link) => link.variantId)),
      );
    }
    return map;
  }, [activeBucket]);

  useEffect(() => {
    if (!activeBucket) {
      setSelectedCollectionId(null);
      return;
    }
    if (selectedCollectionId !== activeBucket.id) {
      setSelectedCollectionId(activeBucket.id);
    }
  }, [activeBucket, selectedCollectionId]);

  useEffect(() => {
    if (!activeBucket) {
      setIsEditingCollectionName(false);
      setCollectionNameDraft("");
      return;
    }
    setIsEditingCollectionName(false);
    setCollectionNameDraft(activeBucket.name);
  }, [activeBucket]);

  useEffect(() => {
    setItemDetailsById({});
    setLoadingDetailsById({});
    setVariantPickerItemId(null);
    setVariantSelectionsByItemId({});
  }, [activeBucket?.id]);

  const ensureItemDetailsLoaded = async (itemId: string) => {
    if (!activeStore) return null;
    if (itemDetailsById[itemId]) {
      return itemDetailsById[itemId];
    }
    setLoadingDetailsById((current) => ({ ...current, [itemId]: true }));
    try {
      const detail = await getLocalItemDetailForDisplay(activeStore, itemId);
      if (!detail) return null;
      setItemDetailsById((current) => ({ ...current, [itemId]: detail }));
      return detail;
    } finally {
      setLoadingDetailsById((current) => ({ ...current, [itemId]: false }));
    }
  };

  const onCreateCollection = async () => {
    if (!activeStore || !identityId || !isBusinessSelected) return;
    const name = draftCollectionName.trim();
    if (!name) return;

    setLoading(true);
    setError(null);
    try {
      await queueItemCollectionCreate(activeStore, identityId, name);
      await syncOnce(activeStore);
      await refresh();
      setDraftCollectionName("");
      const created = collections.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
      if (created) setSelectedCollectionId(created.id);
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to create collection right now.");
    } finally {
      setLoading(false);
    }
  };

  const onRenameCollection = async () => {
    if (!activeStore || !identityId || !isBusinessSelected || !activeBucket) return;
    const nextName = collectionNameDraft.trim();
    if (!nextName) {
      setError("Collection name is required.");
      return;
    }
    if (nextName === activeBucket.name) {
      setIsEditingCollectionName(false);
      return;
    }

    const duplicateExists = buckets.some(
      (bucket) =>
        bucket.name.toLowerCase() === nextName.toLowerCase() &&
        bucket.id !== activeBucket.id,
    );
    if (duplicateExists) {
      setError("A collection with that name already exists.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await queueItemCollectionUpdate(activeStore, identityId, activeBucket.id, nextName);
      await syncOnce(activeStore);
      await refresh();
      setIsEditingCollectionName(false);
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to rename collection right now.");
    } finally {
      setLoading(false);
    }
  };

  const onDeleteCollection = async (bucket: CollectionBucket) => {
    if (!activeStore || !identityId || !isBusinessSelected) return;
    const hasMappedItems = bucket.items.length > 0;
    const confirmed = window.confirm(
      hasMappedItems
        ? `Delete collection '${bucket.name}'? All mapped variants will be removed from this collection.`
        : `Delete collection '${bucket.name}'?`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      await queueItemCollectionDelete(activeStore, identityId, bucket.id);
      await syncOnce(activeStore);
      await refresh();
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to delete collection right now.");
    } finally {
      setLoading(false);
    }
  };

  const onAddVariantsToCollection = async (itemId: string, requestedVariantIds?: string[]) => {
    if (!activeStore || !identityId || !isBusinessSelected || !activeBucket) return;
    const detail = (await ensureItemDetailsLoaded(itemId)) ?? itemDetailsById[itemId];
    if (!detail) {
      setError("Unable to load variants for this item.");
      return;
    }

    const existingVariantIds = activeVariantIdsByItemId.get(itemId) ?? new Set<string>();
    const availableVariantIds = new Set(detail.variants.map((variant) => variant.id));
    const targetVariantIds = (requestedVariantIds ?? detail.variants.map((variant) => variant.id))
      .filter((variantId) => availableVariantIds.has(variantId))
      .filter((variantId) => !existingVariantIds.has(variantId));

    if (targetVariantIds.length === 0) {
      setError("All selected variants are already in this collection.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      for (const variantId of targetVariantIds) {
        await queueItemCollectionMembershipCreate(
          activeStore,
          identityId,
          activeBucket.id,
          variantId,
        );
      }
      await syncOnce(activeStore);
      await refresh();
      if (requestedVariantIds) {
        setVariantPickerItemId(null);
        setVariantSelectionsByItemId((current) => ({ ...current, [itemId]: [] }));
      }
      setItemSearchDraft("");
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to add variants to collection right now.");
    } finally {
      setLoading(false);
    }
  };

  const onRemoveVariantFromCollection = async (membershipId: string) => {
    if (!activeStore || !identityId || !isBusinessSelected) return;
    setLoading(true);
    setError(null);
    try {
      await queueItemCollectionMembershipDelete(activeStore, identityId, membershipId);
      await syncOnce(activeStore);
      await refresh();
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to remove variant from collection right now.");
    } finally {
      setLoading(false);
    }
  };

  const searchableItems = useMemo(() => {
    const q = itemSearchDraft.trim().toLowerCase();
    return items
      .filter((item) => {
        const activeCount = activeVariantIdsByItemId.get(item.entityId)?.size ?? 0;
        const totalCount = Math.max(item.variantCount, 1);
        return activeCount < totalCount;
      })
      .filter((item) => {
        if (!q) return true;
        return item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [activeVariantIdsByItemId, itemSearchDraft, items]);

  const activeVariantRows = useMemo<CollectionVariantRow[]>(() => {
    const rows: CollectionVariantRow[] = [];
    const membershipById = new Map(memberships.map((entry) => [entry.id, entry]));
    for (const group of activeBucket?.items ?? []) {
      const detailedVariants = itemDetailsById[group.item.entityId]?.variants ?? [];
      for (const link of group.links) {
        const membership = membershipById.get(link.membershipId);
        const variant =
          detailedVariants.find((entry) => entry.id === link.variantId);
        rows.push({
          membershipId: link.membershipId,
          itemId: group.item.entityId,
          itemName: group.item.name,
          variantId: link.variantId,
          variantName:
            membership?.variantName?.trim() || variant?.name?.trim() || "Unnamed variant",
          sku: membership?.variantSku?.trim() || variant?.sku?.trim() || "",
          isDefault: membership?.variantIsDefault ?? Boolean(variant?.isDefault),
          isActive: membership?.variantIsActive ?? variant?.isActive ?? true,
        });
      }
    }
    return rows.sort((left, right) => {
      const itemCompare = left.itemName.localeCompare(right.itemName);
      if (itemCompare !== 0) return itemCompare;
      return left.variantName.localeCompare(right.variantName);
    });
  }, [activeBucket, itemDetailsById, memberships]);

  return (
    <section className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
      <Card className="p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5 lg:shrink-0">
          <CardTitle className="text-sm">Collections</CardTitle>
          <CardDescription className="text-[11px] lg:text-[10px]">
            Curate reusable item groups for campaigns, menus, and quick access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="space-y-1 lg:shrink-0">
            <div className="flex gap-1">
              <Input
                value={draftCollectionName}
                onChange={(event) => setDraftCollectionName(event.target.value)}
                placeholder="Add collection"
                className="h-8 rounded-lg px-2 text-xs"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onCreateCollection();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  void onCreateCollection();
                }}
                disabled={loading || !draftCollectionName.trim()}
              >
                Add
              </Button>
            </div>
            {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
          </div>

          <div className="space-y-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {buckets.map((bucket) => (
              <div
                key={bucket.id}
                className={`flex min-h-8 items-center gap-1 rounded-lg border px-1.5 py-1 text-left text-xs transition ${
                  activeBucket?.id === bucket.id
                    ? "border-[#8fb6e2] bg-[#edf5ff] text-[#163a63]"
                    : "border-border/70 bg-white/70 text-foreground/80 hover:bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCollectionId(bucket.id)}
                  className="flex h-6 min-w-0 flex-1 items-center justify-between"
                >
                  <span className="truncate font-medium">{bucket.name}</span>
                  <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px]">
                    {bucket.items.reduce((count, itemGroup) => count + itemGroup.links.length, 0)}
                  </span>
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#8a2d2d] transition hover:bg-[#ffecec] disabled:opacity-50"
                  onClick={() => {
                    void onDeleteCollection(bucket);
                  }}
                  disabled={loading}
                  aria-label={`Delete collection ${bucket.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="space-y-1 p-0 pb-1.5 lg:shrink-0">
          {isEditingCollectionName ? (
            <div className="flex items-center gap-1">
              <Input
                value={collectionNameDraft}
                onChange={(event) => setCollectionNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onRenameCollection();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setIsEditingCollectionName(false);
                    setCollectionNameDraft(activeBucket?.name ?? "");
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
                  void onRenameCollection();
                }}
                disabled={loading}
                aria-label="Save collection name"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 transition hover:bg-white/80 disabled:opacity-50"
                onClick={() => {
                  setIsEditingCollectionName(false);
                  setCollectionNameDraft(activeBucket?.name ?? "");
                }}
                disabled={loading}
                aria-label="Cancel collection rename"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm">{activeBucket?.name ?? "Collection"}</CardTitle>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#2f6fb7] transition hover:bg-[#e9f2ff] disabled:opacity-50"
                onClick={() => {
                  setIsEditingCollectionName(true);
                  setCollectionNameDraft(activeBucket?.name ?? "");
                  setError(null);
                }}
                disabled={loading || !activeBucket}
                aria-label="Edit collection name"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              value={itemSearchDraft}
              onChange={(event) => setItemSearchDraft(event.target.value)}
              placeholder="Search items to add"
              className="h-8 rounded-lg pl-7 text-xs"
            />
          </div>
          {itemSearchDraft.trim().length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/70 bg-white/70 p-1">
              {searchableItems.length > 0 ? (
                searchableItems.map((item) => {
                  const activeCount = activeVariantIdsByItemId.get(item.entityId)?.size ?? 0;
                  const totalCount = Math.max(item.variantCount, 1);
                  const detail = itemDetailsById[item.entityId];
                  const isPickerOpen = variantPickerItemId === item.entityId;
                  const isDetailsLoading = Boolean(loadingDetailsById[item.entityId]);
                  const selection = variantSelectionsByItemId[item.entityId] ?? [];
                  return (
                    <div key={item.entityId} className="rounded-md px-1 py-1 hover:bg-white">
                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-foreground">{item.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {item.sku || "No SKU"} | {activeCount}/{totalCount} variants in collection
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => {
                              void onAddVariantsToCollection(item.entityId);
                            }}
                            disabled={loading || activeCount >= totalCount}
                          >
                            Add All
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => {
                              if (isPickerOpen) {
                                setVariantPickerItemId(null);
                                return;
                              }
                              void ensureItemDetailsLoaded(item.entityId);
                              setVariantPickerItemId(item.entityId);
                              setVariantSelectionsByItemId((current) => ({
                                ...current,
                                [item.entityId]: [],
                              }));
                            }}
                            disabled={loading}
                          >
                            {isPickerOpen ? "Close" : "Choose"}
                          </Button>
                        </div>
                      </div>

                      {isPickerOpen ? (
                        <div className="mt-1 rounded-md border border-white/80 bg-white/70 p-1">
                          {isDetailsLoading ? (
                            <p className="text-[10px] text-muted-foreground">Loading variants...</p>
                          ) : !detail || detail.variants.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground">No variants found.</p>
                          ) : (
                            <>
                              <div className="max-h-28 space-y-0.5 overflow-y-auto">
                                {detail.variants.map((variant) => {
                                  const existing = activeVariantIdsByItemId
                                    .get(item.entityId)
                                    ?.has(variant.id);
                                  const checked = selection.includes(variant.id);
                                  return (
                                    <label
                                      key={variant.id}
                                      className="flex items-center justify-between gap-1 rounded px-1 py-0.5 text-[10px] hover:bg-white"
                                    >
                                      <span className="truncate">
                                        {variant.name || "Unnamed variant"}
                                        {variant.sku ? ` | ${variant.sku}` : ""}
                                      </span>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={Boolean(existing)}
                                        onChange={(event) => {
                                          setVariantSelectionsByItemId((current) => {
                                            const currentSelection = current[item.entityId] ?? [];
                                            const nextSelection = event.target.checked
                                              ? [...currentSelection, variant.id]
                                              : currentSelection.filter((id) => id !== variant.id);
                                            return {
                                              ...current,
                                              [item.entityId]: nextSelection,
                                            };
                                          });
                                        }}
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                              <div className="mt-1 flex justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  disabled={loading || selection.length === 0}
                                  onClick={() => {
                                    void onAddVariantsToCollection(item.entityId, selection);
                                  }}
                                >
                                  Add Selected
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="px-1 py-1 text-[10px] text-muted-foreground">No matching items.</p>
              )}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-2 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {!activeBucket || activeVariantRows.length === 0 ? (
              <div className="rounded-lg border border-white/70 bg-white/65 px-2 py-2 text-xs text-muted-foreground">
                No variants mapped to this collection.
              </div>
            ) : (
              <>
                <ul className="grid gap-1.5 sm:grid-cols-2 lg:hidden">
                  {activeVariantRows.map((row) => (
                    <li key={row.membershipId} className="rounded-lg border border-white/75 bg-white/70 px-2 py-1 text-left">
                      <p className="text-xs font-semibold text-foreground">{row.itemName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.variantName}
                        {row.sku ? ` | ${row.sku}` : ""}
                      </p>
                      <div className="mt-1 flex justify-end">
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#8a2d2d] transition hover:bg-[#ffecec]"
                          onClick={() => {
                            void onRemoveVariantFromCollection(row.membershipId);
                          }}
                          aria-label={`Remove ${row.variantName} from collection`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-hidden rounded-xl border border-white/65 bg-white/55 lg:block">
                  <table className="w-full table-fixed border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-white/80 text-[11px] uppercase tracking-[0.04em] text-muted-foreground backdrop-blur">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Variant</th>
                        <th className="w-44 px-3 py-2">SKU</th>
                        <th className="w-20 px-3 py-2">Default</th>
                        <th className="w-20 px-3 py-2">Active</th>
                        <th className="w-32 px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeVariantRows.map((row) => (
                        <tr key={row.membershipId} className="border-t border-white/60 text-sm">
                          <td className="truncate px-3 py-1.5 align-middle font-medium text-foreground">{row.itemName}</td>
                          <td className="truncate px-3 py-1.5 align-middle text-foreground/90">{row.variantName}</td>
                          <td className="truncate px-3 py-1.5 align-middle text-muted-foreground">{row.sku || "Not set"}</td>
                          <td className="px-3 py-1.5 align-middle text-muted-foreground">{row.isDefault ? "Yes" : "No"}</td>
                          <td className="px-3 py-1.5 align-middle text-muted-foreground">{row.isActive ? "Yes" : "No"}</td>
                          <td className="px-3 py-1.5 text-right align-middle">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/app/items/${row.itemId}`)}
                              >
                                Manage
                              </Button>
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#8a2d2d] transition hover:bg-[#ffecec]"
                                onClick={() => {
                                  void onRemoveVariantFromCollection(row.membershipId);
                                }}
                                aria-label={`Remove ${row.variantName} from collection`}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
