"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type MeResponse = {
  success: boolean;
  role?: string | null;
};

type AdminStore = {
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

type ListStoresResponse = {
  success: boolean;
  message?: string;
  stores?: AdminStore[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const ADMIN_ROLE = "PLATFORM_ADMIN";
const PAGE_SIZE = 10;

const toListStoresUrl = (
  filters: {
    storeName: string;
    ownerEmail: string;
    ownerPhone: string;
  },
  page: number,
  limit: number,
) => {
  const params = new URLSearchParams();

  if (filters.storeName.trim()) {
    params.set("storeName", filters.storeName.trim());
  }

  if (filters.ownerEmail.trim()) {
    params.set("ownerEmail", filters.ownerEmail.trim());
  }

  if (filters.ownerPhone.trim()) {
    params.set("ownerPhone", filters.ownerPhone.trim());
  }

  params.set("page", String(page));
  params.set("limit", String(limit));

  const query = params.toString();
  return query ? `/api/admin/stores?${query}` : "/api/admin/stores";
};

export default function AdminStoreOnboardingCard() {
  const [role, setRole] = useState<string | null>(null);

  const [filterStoreName, setFilterStoreName] = useState("");
  const [filterOwnerEmail, setFilterOwnerEmail] = useState("");
  const [filterOwnerPhone, setFilterOwnerPhone] = useState("");
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const activeFilters = {
    storeName: filterStoreName,
    ownerEmail: filterOwnerEmail,
    ownerPhone: filterOwnerPhone,
  };

  const loadStores = useCallback(
    async (
      filters: {
        storeName: string;
        ownerEmail: string;
        ownerPhone: string;
      },
      page: number,
    ) => {
      setIsLoadingStores(true);
      setStoresError(null);

      try {
        const response = await fetch(
          toListStoresUrl(filters, page, PAGE_SIZE),
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          },
        );

        const payload = (await response.json()) as ListStoresResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? "Unable to load stores.");
        }

        setStores(payload.stores ?? []);
        setPagination(
          payload.pagination ?? {
            page,
            limit: PAGE_SIZE,
            total: 0,
            totalPages: 0,
          },
        );
        setCurrentPage(page);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load stores.";
        setStoresError(message);
      } finally {
        setIsLoadingStores(false);
      }
    },
    [],
  );

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
        // Keep card hidden when identity can't be resolved.
      }
    };

    void loadMe();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (role !== ADMIN_ROLE) {
      return;
    }

    void loadStores(
      {
        storeName: "",
        ownerEmail: "",
        ownerPhone: "",
      },
      1,
    );
  }, [loadStores, role]);

  if (role !== ADMIN_ROLE) {
    return null;
  }

  const handleFilterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadStores(activeFilters, 1);
  };

  const handleClearFilters = async () => {
    const cleared = {
      storeName: "",
      ownerEmail: "",
      ownerPhone: "",
    };

    setFilterStoreName("");
    setFilterOwnerEmail("");
    setFilterOwnerPhone("");

    await loadStores(cleared, 1);
  };

  const handlePrevPage = async () => {
    if (currentPage <= 1 || isLoadingStores) {
      return;
    }

    await loadStores(activeFilters, currentPage - 1);
  };

  const handleNextPage = async () => {
    if (currentPage >= pagination.totalPages || isLoadingStores) {
      return;
    }

    await loadStores(activeFilters, currentPage + 1);
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Stores</h2>
          <p className="mt-1 text-sm text-slate-600">
            Filter by store name and owner email or phone.
          </p>
        </div>
        <Link
          href="/admin/stores/new"
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          New Store
        </Link>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleFilterSubmit}>
        <input
          value={filterStoreName}
          onChange={(event) => setFilterStoreName(event.target.value)}
          placeholder="Filter by store name"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          disabled={isLoadingStores}
        />
        <input
          value={filterOwnerEmail}
          onChange={(event) => setFilterOwnerEmail(event.target.value)}
          placeholder="Filter by owner email"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          disabled={isLoadingStores}
        />
        <input
          value={filterOwnerPhone}
          onChange={(event) => setFilterOwnerPhone(event.target.value)}
          placeholder="Filter by owner phone"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          disabled={isLoadingStores}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-10 flex-1 rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-60"
            disabled={isLoadingStores}
          >
            {isLoadingStores ? "Loading..." : "Apply Filters"}
          </button>
          <button
            type="button"
            onClick={() => void handleClearFilters()}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-60"
            disabled={isLoadingStores}
          >
            Clear
          </button>
        </div>
      </form>

      {storesError ? (
        <p className="mt-3 text-sm text-red-600">{storesError}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
              <p className="text-base font-semibold text-slate-900">
                {store.name}
              </p>
              {store.deletedAt ? (
                <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Inactive
                </p>
              ) : null}
              {store.owner?.email ? (
                <p className="mt-2 text-sm text-slate-700">
                  Email: {store.owner.email}
                </p>
              ) : null}
              {store.owner?.phone ? (
                <p className="text-sm text-slate-700">
                  Phone: {store.owner.phone}
                </p>
              ) : null}
            </article>
          </Link>
        ))}
        {!isLoadingStores && stores.length === 0 ? (
          <p className="text-sm text-slate-600">
            No stores match the current filters.
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-sm text-slate-600">
        <p>
          Page {pagination.page} of {Math.max(pagination.totalPages, 1)} (
          {pagination.total} total)
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handlePrevPage()}
            className="h-9 rounded-lg border border-slate-300 px-3 disabled:opacity-60"
            disabled={isLoadingStores || currentPage <= 1}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => void handleNextPage()}
            className="h-9 rounded-lg border border-slate-300 px-3 disabled:opacity-60"
            disabled={isLoadingStores || currentPage >= pagination.totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
