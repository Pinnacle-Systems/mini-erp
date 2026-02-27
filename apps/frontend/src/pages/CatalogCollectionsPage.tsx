import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Search, Trash2, X } from "lucide-react";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";
import { ItemVariantFlatTable } from "../design-system/organisms/ItemVariantFlatTable";
import type { ItemVariantFlatRow } from "../design-system/organisms/ItemVariantFlatTable";
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

export function CatalogCollectionsPage() {
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
    setVariantSelectionsByItemId({});
  }, [activeBucket?.id]);

  const ensureItemDetailsLoaded = useCallback(
    async (itemId: string) => {
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
    },
    [activeStore, itemDetailsById],
  );

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

  const addableItems = useMemo(() => {
    return items
      .filter((item) => {
        const activeCount = activeVariantIdsByItemId.get(item.entityId)?.size ?? 0;
        const totalCount = Math.max(item.variantCount, 1);
        return activeCount < totalCount;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [activeVariantIdsByItemId, items]);

  useEffect(() => {
    if (!activeStore) return;
    if (itemSearchDraft.trim().length === 0) return;

    const idsToHydrate = addableItems
      .map((item) => item.entityId)
      .filter((itemId) => !itemDetailsById[itemId] && !loadingDetailsById[itemId])
      .slice(0, 20);
    if (idsToHydrate.length === 0) return;

    void Promise.all(idsToHydrate.map((itemId) => ensureItemDetailsLoaded(itemId).catch(() => null)));
  }, [activeStore, addableItems, ensureItemDetailsLoaded, itemDetailsById, itemSearchDraft, loadingDetailsById]);

  const searchableItems = useMemo(() => {
    const q = itemSearchDraft.trim().toLowerCase();
    if (!q) return [];

    return addableItems
      .map((item) => {
        const detail = itemDetailsById[item.entityId];
        const isLoading = Boolean(loadingDetailsById[item.entityId]);
        const existingVariantIds = activeVariantIdsByItemId.get(item.entityId) ?? new Set<string>();
        const itemMatches = item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);

        if (!detail) {
          if (!itemMatches) return null;
          return {
            item,
            variants: [] as ItemDetailDisplay["variants"],
            addableVariantIds: [] as string[],
            loading: isLoading,
          };
        }

        const addableVariants = detail.variants.filter(
          (variant) => !existingVariantIds.has(variant.id),
        );
        if (addableVariants.length === 0) return null;

        const matchingVariants = addableVariants.filter((variant) => {
          if (itemMatches) return true;
          return (
            variant.name.toLowerCase().includes(q) ||
            variant.sku.toLowerCase().includes(q) ||
            variant.barcode.toLowerCase().includes(q)
          );
        });
        if (matchingVariants.length === 0) return null;

        return {
          item,
          variants: matchingVariants,
          addableVariantIds: addableVariants.map((variant) => variant.id),
          loading: false,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 8);
  }, [activeVariantIdsByItemId, addableItems, itemDetailsById, itemSearchDraft, loadingDetailsById]);

  const activeCollectionVariantRows = useMemo<ItemVariantFlatRow[]>(() => {
    const rows: ItemVariantFlatRow[] = [];
    const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));

    for (const group of activeBucket?.items ?? []) {
      const detailedVariants = itemDetailsById[group.item.entityId]?.variants ?? [];

      for (const link of group.links) {
        const membership = membershipById.get(link.membershipId);
        const variant = detailedVariants.find((entry) => entry.id === link.variantId);

        rows.push({
          key: link.membershipId,
          actionId: link.membershipId,
          itemId: group.item.entityId,
          itemName: group.item.name,
          variantName: membership?.variantName?.trim() || variant?.name?.trim() || "-",
          sku: membership?.variantSku?.trim() || variant?.sku?.trim() || "",
          category: group.item.category || "",
          isActive: membership?.variantIsActive ?? variant?.isActive ?? true,
          pending: group.item.pending,
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
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/70 bg-white/70 p-1">
              {searchableItems.length > 0 ? (
                searchableItems.map((item) => {
                  const selection = variantSelectionsByItemId[item.item.entityId] ?? [];
                  const selectableVariantIds = item.addableVariantIds;
                  const hasSingleVariant = selectableVariantIds.length === 1;
                  const singleVariantId = hasSingleVariant ? selectableVariantIds[0] : null;
                  const selectedIds = selection.filter((id) => selectableVariantIds.includes(id));
                  const selectedAll =
                    selectableVariantIds.length > 0 && selectedIds.length === selectableVariantIds.length;

                  return (
                    <div key={item.item.entityId} className="rounded-md border border-white/80 bg-white/85 px-1.5 py-1">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-foreground">{item.item.name}</p>
                          {hasSingleVariant ? (
                            <p className="truncate text-[10px] text-muted-foreground">
                              {item.item.sku || "No SKU"}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            void onAddVariantsToCollection(
                              item.item.entityId,
                              hasSingleVariant && singleVariantId ? [singleVariantId] : selectedIds,
                            );
                          }}
                          disabled={loading || (hasSingleVariant ? !singleVariantId : selectedIds.length === 0)}
                        >
                          {hasSingleVariant ? "Add item" : `Add selected (${selectedIds.length})`}
                        </Button>
                      </div>

                      {item.loading ? (
                        <p className="text-[10px] text-muted-foreground">Loading variants...</p>
                      ) : item.variants.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">No matching variants.</p>
                      ) : hasSingleVariant ? null : (
                        <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-white/80 bg-white/75 p-1">
                          <label className="flex items-center justify-between gap-1 rounded border border-[#d7e7fb] bg-[#f2f8ff] px-1 py-0.5 text-[10px] text-[#174774]">
                            <span className="truncate">
                              All variants for {item.item.name} ({selectableVariantIds.length})
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedAll}
                              onChange={(event) => {
                                setVariantSelectionsByItemId((current) => {
                                  const currentSelection = new Set(current[item.item.entityId] ?? []);
                                  if (event.target.checked) {
                                    for (const variantId of selectableVariantIds) {
                                      currentSelection.add(variantId);
                                    }
                                  } else {
                                    for (const variantId of selectableVariantIds) {
                                      currentSelection.delete(variantId);
                                    }
                                  }
                                  return {
                                    ...current,
                                    [item.item.entityId]: Array.from(currentSelection),
                                  };
                                });
                              }}
                            />
                          </label>
                          {item.variants.map((variant) => {
                            const checked = selection.includes(variant.id);
                            return (
                              <label
                                key={variant.id}
                                className="flex items-center justify-between gap-1 rounded px-1 py-0.5 text-[10px] hover:bg-white"
                              >
                                <span className="truncate">
                                  {variant.name || "-"}
                                  {variant.sku ? ` | ${variant.sku}` : ""}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    setVariantSelectionsByItemId((current) => {
                                      const currentSelection = current[item.item.entityId] ?? [];
                                      const nextSelection = event.target.checked
                                        ? [...currentSelection, variant.id]
                                        : currentSelection.filter((id) => id !== variant.id);
                                      return {
                                        ...current,
                                        [item.item.entityId]: nextSelection,
                                      };
                                    });
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
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
            {!activeBucket || activeCollectionVariantRows.length === 0 ? (
              <div className="rounded-lg border border-white/70 bg-white/65 px-2 py-2 text-xs text-muted-foreground">
                No variants mapped to this collection.
              </div>
            ) : (
              <ItemVariantFlatTable
                rows={activeCollectionVariantRows}
                activeStore={activeStore}
                actionLabel="Remove"
                actionIcon={Trash2}
                actionClassName="h-7 w-7 rounded-full border-none bg-transparent p-0 text-[#8a2d2d] hover:bg-[#ffecec]"
                onAction={(row) => {
                  if (!row.actionId) return;
                  void onRemoveVariantFromCollection(row.actionId);
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
