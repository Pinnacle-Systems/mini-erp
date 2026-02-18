"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type MeResponse = {
  success: boolean;
  role?: string | null;
};

type StoreDetail = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  deletedAt: string | null;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type StoreDetailResponse = {
  success: boolean;
  message?: string;
  store?: StoreDetail;
};

type UpdateStoreResponse = {
  success: boolean;
  message?: string;
  store?: {
    id: string;
    name: string;
    deletedAt: string | null;
  };
};

const ADMIN_ROLE = "PLATFORM_ADMIN";

export default function StoreDetailPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = useMemo(() => params?.storeId ?? "", [params]);

  const [role, setRole] = useState<string | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(false);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [storeName, setStoreName] = useState("");
  const [isActive, setIsActive] = useState(true);
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
    if (role !== ADMIN_ROLE || !storeId) {
      return;
    }

    let active = true;

    const loadStore = async () => {
      setIsLoadingStore(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        const payload = (await response.json()) as StoreDetailResponse;

        if (!response.ok || !payload.success || !payload.store) {
          throw new Error(payload.message ?? "Unable to load store.");
        }

        if (!active) {
          return;
        }

        setStore(payload.store);
        setStoreName(payload.store.name);
        setIsActive(!payload.store.deletedAt);
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Unable to load store.";
        setError(message);
      } finally {
        if (active) {
          setIsLoadingStore(false);
        }
      }
    };

    void loadStore();

    return () => {
      active = false;
    };
  }, [role, storeId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!storeName.trim()) {
      setError("Store name is required.");
      return;
    }

    if (!storeId) {
      setError("Store not found.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          storeName: storeName.trim(),
          isActive,
        }),
      });

      const payload = (await response.json()) as UpdateStoreResponse;

      if (!response.ok || !payload.success || !payload.store) {
        throw new Error(payload.message ?? "Unable to update store name.");
      }

      setStore((currentStore) =>
        currentStore
          ? {
            ...currentStore,
            name: payload.store?.name ?? currentStore.name,
            deletedAt: payload.store?.deletedAt ?? currentStore.deletedAt,
          }
          : currentStore,
      );
      setStoreName(payload.store.name);
      setIsActive(!payload.store.deletedAt);
      setSuccess("Store updated.");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to update store name.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (role !== ADMIN_ROLE) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">Only platform admins can view store details.</p>
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
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Store Detail</h1>
          {store ? <p className="mt-1 text-sm text-slate-600">Store ID: {store.id}</p> : null}
        </div>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Back
        </Link>
      </div>

      {isLoadingStore ? <p className="mt-4 text-sm text-slate-600">Loading store...</p> : null}

      {!isLoadingStore && store ? (
        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <input
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            placeholder="Store name"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            disabled={isSubmitting}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isSubmitting}
            />
            Active
          </label>
          {!isActive ? (
            <p className="text-sm font-medium text-amber-700">
              This store is deactivated (soft deleted).
            </p>
          ) : null}

          {store.owner?.email ? (
            <p className="text-sm text-slate-700">Owner email: {store.owner.email}</p>
          ) : null}
          {store.owner?.phone ? (
            <p className="text-sm text-slate-700">Owner phone: {store.owner.phone}</p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Store"}
          </button>
        </form>
      ) : null}

      {!isLoadingStore && !store && error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}
      {!isLoadingStore && !store && !error ? (
        <p className="mt-4 text-sm text-slate-600">Store not found.</p>
      ) : null}
    </section>
  );
}
