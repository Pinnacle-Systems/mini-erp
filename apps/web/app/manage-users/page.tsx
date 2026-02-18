"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type MemberRole = "OWNER" | "MANAGER" | "CASHIER" | string;

type MemberRow = {
  id: string;
  identityId: string;
  role: MemberRole;
  isSelf: boolean;
  canManageMember: boolean;
  identity: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
};

type MembersResponse = {
  success: boolean;
  actorRole?: MemberRole;
  assignableRoles?: MemberRole[];
  members?: MemberRow[];
  message?: string;
};

const OWNER_MEMBER_ROLE = "OWNER";
const MANAGER_MEMBER_ROLE = "MANAGER";

export default function ManageUsersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [actorRole, setActorRole] = useState<MemberRole | null>(null);
  const [assignableRoles, setAssignableRoles] = useState<MemberRole[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<MemberRole>("");
  const [isUpdatingMemberId, setIsUpdatingMemberId] = useState<string | null>(null);
  const [isDeletingMemberId, setIsDeletingMemberId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, MemberRole>>({});

  const canManageUsers = actorRole === OWNER_MEMBER_ROLE || actorRole === MANAGER_MEMBER_ROLE;

  const loadMembers = async () => {
    setMembersError(null);

    try {
      const response = await fetch("/api/store/members", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const payload = (await response.json()) as MembersResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Unable to load store members.");
      }

      const nextAssignableRoles = payload.assignableRoles ?? [];
      const nextMembers = payload.members ?? [];

      setActorRole(payload.actorRole ?? null);
      setAssignableRoles(nextAssignableRoles);
      setMembers(nextMembers);
      setRole((prevRole) => {
        if (prevRole && nextAssignableRoles.includes(prevRole)) {
          return prevRole;
        }
        return nextAssignableRoles[0] ?? "";
      });

      setPendingRoles((prevPendingRoles) => {
        const next: Record<string, MemberRole> = {};
        nextMembers.forEach((member) => {
          next[member.id] = prevPendingRoles[member.id] ?? member.role;
        });
        return next;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load store members.";
      setMembersError(message);
      setActorRole(null);
      setAssignableRoles([]);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, []);

  const managerSummary = useMemo(() => {
    const managerCount = members.filter((member) => member.role === "MANAGER").length;
    const cashierCount = members.filter((member) => member.role === "CASHIER").length;
    return { managerCount, cashierCount };
  }, [members]);

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!role) {
      setSubmitError("Select a role.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/store/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase() || undefined,
          phone: phone.trim() || undefined,
          role,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        identityCreated?: boolean;
        defaultPassword?: string | null;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Unable to add store member.");
      }

      setName("");
      setEmail("");
      setPhone("");
      setSuccessMessage(
        payload.identityCreated && payload.defaultPassword
          ? `User added. Default password: ${payload.defaultPassword}`
          : "User added.",
      );
      await loadMembers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to add store member.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (member: MemberRow) => {
    const nextRole = pendingRoles[member.id] ?? member.role;
    if (nextRole === member.role) {
      return;
    }

    setIsUpdatingMemberId(member.id);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/store/members/${encodeURIComponent(member.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: nextRole }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Unable to update role.");
      }

      setSuccessMessage("Membership role updated.");
      await loadMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update role.";
      setSubmitError(message);
    } finally {
      setIsUpdatingMemberId(null);
    }
  };

  const handleDeleteMember = async (member: MemberRow) => {
    setIsDeletingMemberId(member.id);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/store/members/${encodeURIComponent(member.id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Unable to delete membership.");
      }

      setSuccessMessage("Membership deleted.");
      await loadMembers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete membership.";
      setSubmitError(message);
    } finally {
      setIsDeletingMemberId(null);
    }
  };

  return (
    <div className="grid gap-4 pb-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-500">Store Access</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Manage Users
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Add members, change membership roles, and remove memberships for this store.
        </p>
      </section>

      {membersError ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-red-600">{membersError}</p>
        </section>
      ) : null}

      {!isLoading && !canManageUsers ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-700">
            Only store owners and managers can manage memberships.
          </p>
        </section>
      ) : null}

      {!isLoading && canManageUsers ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Add User To Store</h2>
          <p className="mt-1 text-sm text-slate-600">
            Managers: {managerSummary.managerCount} | Cashiers: {managerSummary.cashierCount}
          </p>

          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleAddMember}>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:border-slate-500"
                placeholder="Jane Doe"
                disabled={isSubmitting}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:border-slate-500"
                disabled={isSubmitting || assignableRoles.length === 0}
              >
                {assignableRoles.map((assignableRole) => (
                  <option key={assignableRole} value={assignableRole}>
                    {assignableRole}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:border-slate-500"
                placeholder="jane@store.com"
                disabled={isSubmitting}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:border-slate-500"
                placeholder="5551234567"
                disabled={isSubmitting}
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || assignableRoles.length === 0}
              >
                {isSubmitting ? "Adding..." : "Add User"}
              </button>
            </div>
          </form>

          {submitError ? <p className="mt-3 text-sm text-red-600">{submitError}</p> : null}
          {successMessage ? <p className="mt-3 text-sm text-emerald-700">{successMessage}</p> : null}
        </section>
      ) : null}

      {!isLoading && canManageUsers ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Store Members</h2>
          {members.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No members found for this store.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {members.map((member) => {
                const selectedRole = pendingRoles[member.id] ?? member.role;

                return (
                  <article key={member.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {member.identity.name?.trim() || "Unnamed user"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {member.identity.email || member.identity.phone || "No contact info"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Role: {member.role}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select
                        value={selectedRole}
                        onChange={(event) =>
                          setPendingRoles((prev) => ({
                            ...prev,
                            [member.id]: event.target.value,
                          }))}
                        disabled={!member.canManageMember || Boolean(isUpdatingMemberId)}
                        className="h-9 rounded-lg border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {assignableRoles.map((assignableRole) => (
                          <option key={`${member.id}-${assignableRole}`} value={assignableRole}>
                            {assignableRole}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void handleUpdateRole(member)}
                        disabled={
                          !member.canManageMember ||
                          Boolean(isUpdatingMemberId) ||
                          selectedRole === member.role
                        }
                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUpdatingMemberId === member.id ? "Saving..." : "Update Role"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteMember(member)}
                        disabled={!member.canManageMember || Boolean(isDeletingMemberId)}
                        className="h-9 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeletingMemberId === member.id ? "Deleting..." : "Delete Membership"}
                      </button>
                    </div>

                    {member.isSelf ? (
                      <p className="mt-2 text-xs text-amber-700">
                        Your own membership cannot be changed from this screen.
                      </p>
                    ) : null}
                    {!member.isSelf && !member.canManageMember ? (
                      <p className="mt-2 text-xs text-slate-500">
                        You do not have permission to manage this member.
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
