import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, CircleMinus, CirclePlus, Pencil, Search, Trash2, X } from "lucide-react";
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

type CollectionItemLink = {
  item: ItemDisplay;
  membershipId: string;
};

type CollectionBucket = {
  id: string;
  name: string;
  items: CollectionItemLink[];
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
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);
  const [itemDetailsById, setItemDetailsById] = useState<Record<string, ItemDetailDisplay>>({});
  const [loadingDetailsById, setLoadingDetailsById] = useState<Record<string, boolean>>({});
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
    const linksByCollectionId = memberships.reduce<Record<string, CollectionItemLink[]>>(
      (acc, membership) => {
        const item = itemById.get(membership.itemId);
        if (!item) return acc;
        acc[membership.collectionId] = [
          ...(acc[membership.collectionId] ?? []),
          { item, membershipId: membership.id },
        ];
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
    setExpandedItemIds([]);
    setItemDetailsById({});
    setLoadingDetailsById({});
  }, [activeBucket?.id]);

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
        ? `Delete collection '${bucket.name}'? All mapped items will be removed from this collection.`
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

  const onAddItemToCollection = async (itemId: string) => {
    if (!activeStore || !identityId || !isBusinessSelected || !activeBucket) return;
    setLoading(true);
    setError(null);
    try {
      await queueItemCollectionMembershipCreate(activeStore, identityId, activeBucket.id, itemId);
      await syncOnce(activeStore);
      await refresh();
      setItemSearchDraft("");
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to add item to collection right now.");
    } finally {
      setLoading(false);
    }
  };

  const onRemoveItemFromCollection = async (membershipId: string) => {
    if (!activeStore || !identityId || !isBusinessSelected) return;
    setLoading(true);
    setError(null);
    try {
      await queueItemCollectionMembershipDelete(activeStore, identityId, membershipId);
      await syncOnce(activeStore);
      await refresh();
    } catch (nextError) {
      console.error(nextError);
      setError("Unable to remove item from collection right now.");
    } finally {
      setLoading(false);
    }
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

  const searchableItems = useMemo(() => {
    const collectionItemIds = new Set(activeBucket?.items.map((entry) => entry.item.entityId) ?? []);
    const q = itemSearchDraft.trim().toLowerCase();
    return items
      .filter((item) => !collectionItemIds.has(item.entityId))
      .filter((item) => {
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [activeBucket, itemSearchDraft, items]);

  return (
    <section className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
      <Card className="p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5">
          <CardTitle className="text-sm">Collections</CardTitle>
          <CardDescription className="text-[11px] lg:text-[10px]">
            Curate reusable item groups for campaigns, menus, and quick access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="space-y-1">
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
                    {bucket.items.length}
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
        <CardHeader className="space-y-1 p-0 pb-1.5">
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
            <div className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-white/70 bg-white/70 p-1">
              {searchableItems.length > 0 ? (
                searchableItems.map((item) => (
                  <div key={item.entityId} className="flex items-center justify-between gap-1 rounded-md px-1 py-1 hover:bg-white">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-foreground">{item.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{item.sku || "No SKU"}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        void onAddItemToCollection(item.entityId);
                      }}
                      disabled={loading}
                    >
                      Add
                    </Button>
                  </div>
                ))
              ) : (
                <p className="px-1 py-1 text-[10px] text-muted-foreground">No matching items.</p>
              )}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-2 p-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {!activeBucket || activeBucket.items.length === 0 ? (
            <div className="rounded-lg border border-white/70 bg-white/65 px-2 py-2 text-xs text-muted-foreground">
              No items mapped to this collection.
            </div>
          ) : (
            <>
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:hidden">
                {activeBucket.items.map(({ item, membershipId }) => (
                  <li key={item.entityId} className="rounded-lg border border-white/75 bg-white/70 px-2 py-1.5 text-left">
                    <p className="text-xs font-semibold text-foreground">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.variantCount > 1
                        ? `Variants: ${item.variantCount}`
                        : `SKU: ${item.sku || "Not set"}`}
                    </p>
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#8a2d2d] transition hover:bg-[#ffecec]"
                        onClick={() => {
                          void onRemoveItemFromCollection(membershipId);
                        }}
                        aria-label={`Remove ${item.name} from collection`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
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
                    {activeBucket.items.map(({ item, membershipId }) => {
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
                            <td className="px-3 py-2 align-middle font-medium text-foreground">{item.name}</td>
                            <td className="truncate px-3 py-2 align-middle text-muted-foreground">{item.sku || "Not set"}</td>
                            <td className="px-3 py-2 align-middle text-muted-foreground">{item.variantCount}</td>
                            <td className="px-3 py-2 text-right align-middle">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/app/items/${item.entityId}`)}
                                >
                                  Manage
                                </Button>
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#8a2d2d] transition hover:bg-[#ffecec]"
                                  onClick={() => {
                                    void onRemoveItemFromCollection(membershipId);
                                  }}
                                  aria-label={`Remove ${item.name} from collection`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
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
                                              <td className="px-2 py-1.5 text-muted-foreground">{variant.isDefault ? "Yes" : "No"}</td>
                                              <td className="px-2 py-1.5 text-muted-foreground">{variant.isActive ? "Yes" : "No"}</td>
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
                                              <td className="px-2 py-1.5 text-muted-foreground">{variant.usageCount}</td>
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
