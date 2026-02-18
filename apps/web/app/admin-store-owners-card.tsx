"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

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

type ListStoreOwnersResponse = {
  success: boolean;
  message?: string;
  owners?: StoreOwner[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const ADMIN_ROLE = "PLATFORM_ADMIN";
const PAGE_SIZE = 10;

const toListStoreOwnersUrl = (
  filters: {
    ownerEmail: string;
    ownerPhone: string;
  },
  page: number,
  limit: number,
) => {
  const params = new URLSearchParams();

  if (filters.ownerEmail.trim()) {
    params.set("ownerEmail", filters.ownerEmail.trim());
  }

  if (filters.ownerPhone.trim()) {
    params.set("ownerPhone", filters.ownerPhone.trim());
  }

  params.set("page", String(page));
  params.set("limit", String(limit));

  const query = params.toString();
  return query ? `/api/admin/store-owners?${query}` : "/api/admin/store-owners";
};

export default function AdminStoreOwnersCard() {
  const [role, setRole] = useState<string | null>(null);

  const [filterOwnerEmail, setFilterOwnerEmail] = useState("");
  const [filterOwnerPhone, setFilterOwnerPhone] = useState("");
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [ownersError, setOwnersError] = useState<string | null>(null);
  const [owners, setOwners] = useState<StoreOwner[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const activeFilters = {
    ownerEmail: filterOwnerEmail,
    ownerPhone: filterOwnerPhone,
  };

  const loadOwners = useCallback(
    async (
      filters: {
        ownerEmail: string;
        ownerPhone: string;
      },
      page: number,
    ) => {
      setIsLoadingOwners(true);
      setOwnersError(null);

      try {
        const response = await fetch(
          toListStoreOwnersUrl(filters, page, PAGE_SIZE),
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          },
        );

        const payload = (await response.json()) as ListStoreOwnersResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? "Unable to load store owners.");
        }

        setOwners(payload.owners ?? []);
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
            : "Unable to load store owners.";
        setOwnersError(message);
      } finally {
        setIsLoadingOwners(false);
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

    void loadOwners(
      {
        ownerEmail: "",
        ownerPhone: "",
      },
      1,
    );
  }, [loadOwners, role]);

  if (role !== ADMIN_ROLE) {
    return null;
  }

  const handleFilterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadOwners(activeFilters, 1);
  };

  const handleClearFilters = async () => {
    const cleared = {
      ownerEmail: "",
      ownerPhone: "",
    };

    setFilterOwnerEmail("");
    setFilterOwnerPhone("");

    await loadOwners(cleared, 1);
  };

  const handlePrevPage = async () => {
    if (currentPage <= 1 || isLoadingOwners) {
      return;
    }

    await loadOwners(activeFilters, currentPage - 1);
  };

  const handleNextPage = async () => {
    if (currentPage >= pagination.totalPages || isLoadingOwners) {
      return;
    }

    await loadOwners(activeFilters, currentPage + 1);
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Store Owners
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Filter by owner email or phone.
          </p>
        </div>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleFilterSubmit}>
        <input
          value={filterOwnerEmail}
          onChange={(event) => setFilterOwnerEmail(event.target.value)}
          placeholder="Filter by owner email"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          disabled={isLoadingOwners}
        />
        <input
          value={filterOwnerPhone}
          onChange={(event) => setFilterOwnerPhone(event.target.value)}
          placeholder="Filter by owner phone"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          disabled={isLoadingOwners}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-10 flex-1 rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-60"
            disabled={isLoadingOwners}
          >
            {isLoadingOwners ? "Loading..." : "Apply Filters"}
          </button>
          <button
            type="button"
            onClick={() => void handleClearFilters()}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-60"
            disabled={isLoadingOwners}
          >
            Clear
          </button>
        </div>
      </form>

      {ownersError ? (
        <p className="mt-3 text-sm text-red-600">{ownersError}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {owners.map((owner) => (
          <Link
            key={owner.id}
            href={`/admin/store-owners/${owner.id}`}
            className="rounded-xl border border-slate-200 p-4 shadow-sm transition hover:border-slate-300"
          >
            <article>
              <p className="text-base font-semibold text-slate-900">
                {owner.name?.trim() || "Unnamed owner"}
              </p>
              {owner.email ? (
                <p className="mt-2 text-sm text-slate-700">
                  Email: {owner.email}
                </p>
              ) : null}
              {owner.phone ? (
                <p className="text-sm text-slate-700">Phone: {owner.phone}</p>
              ) : null}
            </article>
          </Link>
        ))}
        {!isLoadingOwners && owners.length === 0 ? (
          <p className="text-sm text-slate-600">
            No owners match the current filters.
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
            disabled={isLoadingOwners || currentPage <= 1}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => void handleNextPage()}
            className="h-9 rounded-lg border border-slate-300 px-3 disabled:opacity-60"
            disabled={isLoadingOwners || currentPage >= pagination.totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
