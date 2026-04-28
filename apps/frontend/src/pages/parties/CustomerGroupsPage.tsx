import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "../../design-system/atoms/Button";
import { Input } from "../../design-system/atoms/Input";
import { Label } from "../../design-system/atoms/Label";
import { Switch } from "../../design-system/atoms/Switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../design-system/molecules/Card";
import { PageActionBar } from "../../design-system/molecules/PageActionBar";
import { getLocalCustomers, syncOnce, type CustomerRow } from "../../features/sync/engine";
import { useSessionStore } from "../../features/auth/session-business";
import {
  createCustomerGroup,
  deleteCustomerGroup,
  listCustomerGroups,
  updateCustomerGroup,
  type CustomerGroup,
} from "./customer-groups-api";

const DENSE_INPUT_CLASS = "h-8 rounded-xl px-3 text-xs";
const NEW_GROUP_KEY = "__new__";

type GroupDraft = {
  id: string | null;
  name: string;
  isActive: boolean;
  memberIds: string[];
};

const EMPTY_DRAFT: GroupDraft = {
  id: null,
  name: "",
  isActive: true,
  memberIds: [],
};

const toDraft = (group: CustomerGroup): GroupDraft => ({
  id: group.id,
  name: group.name,
  isActive: group.isActive,
  memberIds: group.members.map((member) => member.customerId),
});

const sortGroups = (groups: CustomerGroup[]) =>
  [...groups].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

const upsertGroup = (groups: CustomerGroup[], nextGroup: CustomerGroup) =>
  sortGroups([
    ...groups.filter((group) => group.id !== nextGroup.id),
    nextGroup,
  ]);

export function CustomerGroupsPage() {
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(NEW_GROUP_KEY);
  const [newGroupNameDraft, setNewGroupNameDraft] = useState("");
  const [draft, setDraft] = useState<GroupDraft>(EMPTY_DRAFT);
  const [memberQuery, setMemberQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedKey) ?? null,
    [groups, selectedKey],
  );

  const visibleCustomers = useMemo(() => {
    const normalized = memberQuery.trim().toLowerCase();
    if (!normalized) {
      return [];
    }
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.gstNo].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [customers, memberQuery]);

  const selectedCustomers = useMemo(() => {
    const customersById = new Map(customers.map((customer) => [customer.entityId, customer]));
    return draft.memberIds
      .map((memberId) => customersById.get(memberId))
      .filter((customer): customer is CustomerRow => Boolean(customer));
  }, [customers, draft.memberIds]);

  const addableCustomers = useMemo(
    () =>
      visibleCustomers
        .filter((customer) => !draft.memberIds.includes(customer.entityId))
        .slice(0, 8),
    [draft.memberIds, visibleCustomers],
  );

  const customerIds = useMemo(
    () => new Set(customers.map((customer) => customer.entityId)),
    [customers],
  );

  const unavailableMembers = useMemo(() => {
    const membersById = new Map(
      (selectedGroup?.members ?? []).map((member) => [member.customerId, member]),
    );
    return draft.memberIds
      .filter((memberId) => !customerIds.has(memberId))
      .map((memberId) => membersById.get(memberId))
      .filter((member): member is NonNullable<typeof member> => Boolean(member));
  }, [customerIds, draft.memberIds, selectedGroup]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setGroups([]);
      setCustomers([]);
      setSelectedKey(NEW_GROUP_KEY);
      setDraft(EMPTY_DRAFT);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const localCustomers = await getLocalCustomers(activeStore);
        if (!cancelled) {
          setCustomers(localCustomers);
        }

        await syncOnce(activeStore).catch(() => null);

        const [nextGroups, nextCustomers] = await Promise.all([
          listCustomerGroups(activeStore),
          getLocalCustomers(activeStore),
        ]);

        if (cancelled) {
          return;
        }

        setGroups(sortGroups(nextGroups));
        setCustomers(nextCustomers);
      } catch (nextError) {
        console.error(nextError);
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load customer groups right now.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeStore, isBusinessSelected]);

  useEffect(() => {
    if (selectedKey === NEW_GROUP_KEY) {
      return;
    }

    if (groups.some((group) => group.id === selectedKey)) {
      return;
    }

    setSelectedKey(groups[0]?.id ?? NEW_GROUP_KEY);
  }, [groups, selectedKey]);

  useEffect(() => {
    if (selectedKey === NEW_GROUP_KEY) {
      setDraft(EMPTY_DRAFT);
      return;
    }

    const nextGroup = groups.find((group) => group.id === selectedKey);
    if (nextGroup) {
      setDraft(toDraft(nextGroup));
    }
  }, [groups, selectedKey]);

  const onQuickCreate = async () => {
    if (!activeStore || !isBusinessSelected || saving || loading) {
      return;
    }

    const name = newGroupNameDraft.trim();
    if (!name) {
      setError("Group name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const savedGroup = await createCustomerGroup({
        tenantId: activeStore,
        name,
        isActive: true,
        memberIds: [],
      });
      setGroups((current) => upsertGroup(current, savedGroup));
      setSelectedKey(savedGroup.id);
      setNewGroupNameDraft("");
      setMessage("Customer group created.");
    } catch (nextError) {
      console.error(nextError);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create customer group right now.",
      );
    } finally {
      setSaving(false);
    }
  };

  const onResetDraft = () => {
    if (selectedGroup) {
      setDraft(toDraft(selectedGroup));
      return;
    }
    setDraft(EMPTY_DRAFT);
  };

  const onToggleMember = (customerId: string, checked: boolean) => {
    setDraft((current) => {
      const nextMemberIds = new Set(current.memberIds);
      if (checked) {
        nextMemberIds.add(customerId);
      } else {
        nextMemberIds.delete(customerId);
      }
      return {
        ...current,
        memberIds: [...nextMemberIds],
      };
    });
  };

  const editorTitle =
    draft.name.trim() || (draft.id ? "Untitled Group" : "New Customer Group");
  const editorDescription = draft.id
    ? "Manage the selected group's members and settings."
    : "Set up a new group and choose which customers belong to it.";

  const onSave = async () => {
    if (!activeStore || !isBusinessSelected || saving || loading) {
      return;
    }

    const name = draft.name.trim();

    if (!name) {
      setError("Group name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        tenantId: activeStore,
        name,
        isActive: draft.isActive,
        memberIds: draft.memberIds,
      };
      const savedGroup = draft.id
        ? await updateCustomerGroup(draft.id, payload)
        : await createCustomerGroup(payload);

      setGroups((current) => upsertGroup(current, savedGroup));
      setSelectedKey(savedGroup.id);
      setMessage(draft.id ? "Customer group updated." : "Customer group created.");
    } catch (nextError) {
      console.error(nextError);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save customer group right now.",
      );
    } finally {
      setSaving(false);
    }
  };

  const onDeleteGroup = async (group: CustomerGroup) => {
    if (!activeStore || !isBusinessSelected || loading || saving) {
      return;
    }

    const confirmed = window.confirm(`Delete '${group.name}'?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await deleteCustomerGroup(group.id, activeStore);
      const remainingGroups = groups.filter((entry) => entry.id !== group.id);
      setGroups(remainingGroups);
      if (selectedKey === group.id) {
        setSelectedKey(remainingGroups[0]?.id ?? NEW_GROUP_KEY);
      }
      setMessage("Customer group deleted.");
    } catch (nextError) {
      console.error(nextError);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete customer group right now.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
      <Card className="p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5">
          <CardTitle className="text-sm">Customer Groups</CardTitle>
          <CardDescription className="text-[11px] lg:text-[10px]">
            Group customers for pricing tiers, segments, and reusable sales targeting.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-1 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="space-y-1 lg:shrink-0">
            <Label htmlFor="new-customer-group-name" className="text-[11px] font-medium lg:text-[10px]">
              Group name
            </Label>
            <div className="flex gap-1">
              <Input
                id="new-customer-group-name"
                className="h-8 rounded-lg px-2 text-xs"
                value={newGroupNameDraft}
                onChange={(event) => setNewGroupNameDraft(event.target.value)}
                disabled={loading || saving}
                placeholder="Add customer group"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onQuickCreate();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  void onQuickCreate();
                }}
                disabled={
                  !activeStore ||
                  !isBusinessSelected ||
                  loading ||
                  saving ||
                  !newGroupNameDraft.trim()
                }
              >
                Add
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {loading ? (
              <div className="p-3 text-xs text-muted-foreground">Loading customer groups...</div>
            ) : groups.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">
                No customer groups yet. Create the first one from this list.
              </div>
            ) : (
              <div className="space-y-1 p-1.5 lg:pr-1">
                {groups.map((group) => {
                  const selected = group.id === selectedKey;
                  return (
                    <div
                      key={group.id}
                      className={`flex min-h-8 items-center gap-1 rounded-lg border px-1.5 py-1 text-left text-xs transition ${
                        selected
                          ? "border-primary/35 bg-primary/15 text-foreground"
                          : "border-border/70 bg-card text-foreground/80 hover:bg-muted/65"
                      }`}
                    >
                      <Button
                        type="button"
                        onClick={() => {
                          setSelectedKey(group.id);
                          setError(null);
                          setMessage(null);
                        }}
                        variant="ghost"
                        className="flex h-auto min-w-0 flex-1 items-center justify-between rounded-md px-0 py-0 text-left text-xs font-medium hover:bg-transparent active:bg-transparent active:scale-100"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{group.name}</span>
                          <span className="block text-[10px] leading-tight text-muted-foreground">
                            {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-background/80 px-1 text-[10px] leading-none">
                          {group.memberCount}
                        </span>
                      </Button>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          group.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {group.isActive ? "Active" : "Inactive"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-1.5 text-[11px] text-[#8a2d2d] hover:bg-[#fff1f1]"
                        onClick={() => {
                          void onDeleteGroup(group);
                        }}
                        disabled={loading || saving}
                        aria-label={`Delete group ${group.name}`}
                      >
                        <Trash2 aria-hidden="true" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <CardHeader className="p-0 pb-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">
                {editorTitle}
              </CardTitle>
              <CardDescription className="text-[11px] lg:text-[10px]">
                {editorDescription}
              </CardDescription>
            </div>
            <PageActionBar
              className="lg:contents"
              primaryLabel={draft.id ? "Save Group" : "Create Group"}
              primaryDisabled={!activeStore || !isBusinessSelected || loading || saving}
              primaryLoading={saving}
              primaryLoadingLabel={draft.id ? "Saving..." : "Creating..."}
              onPrimaryClick={() => {
                void onSave();
              }}
              secondaryLabel="Reset"
              secondaryDisabled={!activeStore || !isBusinessSelected || loading || saving}
              onSecondaryClick={onResetDraft}
              showMobileSpacer
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-2 p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          {!activeStore || !isBusinessSelected ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-card p-3 text-xs text-muted-foreground">
              Select a business to manage customer groups.
            </div>
          ) : (
            <>
              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-700">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                  {message}
                </div>
              ) : null}

              <div className="space-y-1">
                <Label htmlFor="customer-group-name" className="text-[11px] font-medium lg:text-[10px]">
                  Group name
                </Label>
                <Input
                  id="customer-group-name"
                  className={DENSE_INPUT_CLASS}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={loading || saving}
                  placeholder="Retail Walk-In"
                />
              </div>

              <div className="rounded-lg border border-border/80 bg-card px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">Group status</p>
                    <p className="text-[11px] text-muted-foreground">
                      Inactive groups stay visible but can be excluded from new assignments.
                    </p>
                  </div>
                  <Switch
                    checked={draft.isActive}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, isActive: checked }))
                    }
                    disabled={loading || saving}
                    aria-label="Toggle customer group status"
                  />
                </div>
              </div>

              <div className="space-y-1 lg:min-h-0 lg:flex lg:flex-1 lg:flex-col">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <Label
                      htmlFor="customer-group-member-search"
                      className="text-[11px] font-medium lg:text-[10px]"
                    >
                      Find customers to add
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {draft.memberIds.length} selected customer
                      {draft.memberIds.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Input
                    id="customer-group-member-search"
                    className={`${DENSE_INPUT_CLASS} w-full min-[642px]:w-56`}
                    value={memberQuery}
                    onChange={(event) => setMemberQuery(event.target.value)}
                    disabled={loading || saving}
                    placeholder="Search customers"
                  />
                </div>

                {memberQuery.trim() ? (
                  <div className="rounded-lg border border-border/80 bg-card">
                    {addableCustomers.length === 0 ? (
                      <div className="p-2.5 text-xs text-muted-foreground">
                        No additional customers match this search.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/70">
                        {addableCustomers.map((customer) => (
                          <div
                            key={customer.entityId}
                            className="flex items-center gap-2 px-2.5 py-2 text-xs"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-foreground">
                                {customer.name}
                              </span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {[customer.phone, customer.email, customer.gstNo]
                                  .filter((value) => value.trim().length > 0)
                                  .join(" • ") || "No contact details"}
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onToggleMember(customer.entityId, true)}
                              disabled={loading || saving}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="rounded-lg border border-border/80 bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  {selectedCustomers.length === 0 && unavailableMembers.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      No customers mapped to this group.
                    </div>
                  ) : (
                    <>
                      {selectedCustomers.length > 0 ? (
                        <div className="divide-y divide-border/70">
                          {selectedCustomers.map((customer) => (
                            <div
                              key={customer.entityId}
                              className="flex items-center gap-2 px-2.5 py-2 text-xs"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-medium text-foreground">{customer.name}</span>
                                  {!customer.isActive ? (
                                    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                      Inactive
                                    </span>
                                  ) : null}
                                  {customer.pending ? (
                                    <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                                      Pending sync
                                    </span>
                                  ) : null}
                                </span>
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {[customer.phone, customer.email, customer.gstNo]
                                    .filter((value) => value.trim().length > 0)
                                    .join(" • ") || "No contact details"}
                                </span>
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-[11px] text-[#8a2d2d] hover:bg-[#fff1f1]"
                                onClick={() => onToggleMember(customer.entityId, false)}
                                disabled={loading || saving}
                                aria-label={`Remove ${customer.name} from group`}
                              >
                                <X aria-hidden="true" />
                                <span>Remove</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {unavailableMembers.length > 0 ? (
                        <div className="border-t border-border/70">
                          {unavailableMembers.map((member) => (
                            <div
                              key={member.customerId}
                              className="flex items-center gap-2 px-2.5 py-2 text-xs"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-foreground">
                                  {member.name}
                                </span>
                                <span className="block text-[11px] text-amber-700">
                                  Not available in the current local customer list
                                </span>
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-[11px] text-[#8a2d2d] hover:bg-[#fff1f1]"
                                onClick={() => onToggleMember(member.customerId, false)}
                                disabled={loading || saving}
                                aria-label={`Remove ${member.name} from group`}
                              >
                                <X aria-hidden="true" />
                                <span>Remove</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
