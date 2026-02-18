"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type MeResponse = {
  success: boolean;
  role?: string | null;
};

type StoreOwner = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type OwnerStore = {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
};

type StoreOwnerResponse = {
  success: boolean;
  message?: string;
  owner?: StoreOwner;
  stores?: OwnerStore[];
};

const ADMIN_ROLE = "PLATFORM_ADMIN";

export default function StoreOwnerDetailPage() {
  const params = useParams<{ ownerId: string }>();
  const ownerId = useMemo(() => params?.ownerId ?? "", [params]);

  const [role, setRole] = useState<string | null>(null);
  const [isLoadingOwner, setIsLoadingOwner] = useState(false);
  const [owner, setOwner] = useState<StoreOwner | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadMe = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as MeResponse;
        if (active && payload.success) {
          setRole(payload.role ?? null);
        }
      } catch {
        // Keep page safe when identity can't be resolved.
      }
    };

    void loadMe();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (role !== ADMIN_ROLE || !ownerId) {
      return;
    }

    let active = true;

    const loadOwner = async () => {
      setIsLoadingOwner(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/store-owners/${encodeURIComponent(ownerId)}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        const payload = (await response.json()) as StoreOwnerResponse;

        if (!response.ok || !payload.success || !payload.owner) {
          throw new Error(payload.message ?? "Unable to load store owner.");
        }

        if (!active) {
          return;
        }

        setOwner(payload.owner);
        setOwnerName(payload.owner.name ?? "");
        setOwnerEmail(payload.owner.email ?? "");
        setOwnerPhone(payload.owner.phone ?? "");
        setStores(payload.stores ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Unable to load store owner.";
        setError(message);
      } finally {
        if (active) {
          setIsLoadingOwner(false);
        }
      }
    };

    void loadOwner();

    return () => {
      active = false;
    };
  }, [ownerId, role]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!ownerEmail.trim() && !ownerPhone.trim()) {
      setError("Owner email or phone is required.");
      return;
    }

    if (!ownerId) {
      setError("Store owner not found.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/store-owners/${encodeURIComponent(ownerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ownerName: ownerName.trim() || undefined,
          ownerEmail: ownerEmail.trim().toLowerCase() || undefined,
          ownerPhone: ownerPhone.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as StoreOwnerResponse;

      if (!response.ok || !payload.success || !payload.owner) {
        throw new Error(payload.message ?? "Unable to update store owner.");
      }

      setOwner(payload.owner);
      setOwnerName(payload.owner.name ?? "");
      setOwnerEmail(payload.owner.email ?? "");
      setOwnerPhone(payload.owner.phone ?? "");
      setSuccess("Store owner updated.");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to update store owner.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (role !== ADMIN_ROLE) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">Only platform admins can view store owners.</p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-slate-900">
          Back to dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Platform Admin</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Store Owner Detail</h1>
          {owner ? <p className="mt-1 text-sm text-slate-600">Owner ID: {owner.id}</p> : null}
        </div>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Back
        </Link>
      </div>

      {isLoadingOwner ? <p className="mt-4 text-sm text-slate-600">Loading owner...</p> : null}

      {!isLoadingOwner && owner ? (
        <div className="mt-4 grid gap-5">
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <input
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Owner name"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
              disabled={isSubmitting}
            />
            <input
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              placeholder="Owner email"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
              disabled={isSubmitting}
            />
            <input
              value={ownerPhone}
              onChange={(event) => setOwnerPhone(event.target.value)}
              placeholder="Owner phone (10 digits)"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
              disabled={isSubmitting}
            />

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

            <button
              type="submit"
              className="h-10 rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Owner"}
            </button>
          </form>

          <div>
            <h2 className="text-base font-semibold text-slate-900">Stores</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stores.map((store) => (
                <Link
                  key={store.id}
                  href={`/admin/stores/${store.id}`}
                  className={`rounded-xl border p-4 shadow-sm transition ${
                    store.deletedAt
                      ? "border-amber-300 bg-amber-50/50 hover:border-amber-400"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <article>
                    <p className="text-base font-semibold text-slate-900">{store.name}</p>
                    {store.deletedAt ? (
                      <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Inactive
                      </p>
                    ) : null}
                  </article>
                </Link>
              ))}
              {stores.length === 0 ? (
                <p className="text-sm text-slate-600">No stores found for this owner.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!isLoadingOwner && !owner && error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {!isLoadingOwner && !owner && !error ? (
        <p className="mt-4 text-sm text-slate-600">Store owner not found.</p>
      ) : null}
    </section>
  );
}
