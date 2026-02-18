"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type MeResponse = {
  success: boolean;
  role?: string | null;
};

type OnboardStoreResponse = {
  success: boolean;
  message?: string;
  store?: {
    id: string;
    name: string;
  };
  ownerIdentityId?: string;
  ownerCreated?: boolean;
  defaultPassword?: string | null;
};

const ADMIN_ROLE = "PLATFORM_ADMIN";

export default function NewStorePage() {
  const [role, setRole] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!storeName.trim()) {
      setError("Store name is required.");
      return;
    }

    if (!ownerEmail.trim() && !ownerPhone.trim()) {
      setError("Owner email or phone is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          storeName: storeName.trim(),
          ownerName: ownerName.trim() || undefined,
          ownerEmail: ownerEmail.trim() || undefined,
          ownerPhone: ownerPhone.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as OnboardStoreResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Unable to onboard store.");
      }

      const baseMessage = `Store ${payload.store?.name ?? ""} created.`;
      const passwordMessage = payload.ownerCreated && payload.defaultPassword
        ? ` Default password: ${payload.defaultPassword}`
        : "";

      setSuccess(`${baseMessage}${passwordMessage}`);
      setStoreName("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPhone("");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to onboard store.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (role !== ADMIN_ROLE) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">Only platform admins can create new stores.</p>
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
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Onboard A New Store</h1>
          <p className="mt-1 text-sm text-slate-600">
            Reuse an existing owner identity by email/phone, or create one with a default password.
          </p>
        </div>
        <Link href="/" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
          Back
        </Link>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <input
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          placeholder="Store name"
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          disabled={isSubmitting}
        />
        <input
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          placeholder="Owner name (optional)"
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
          {isSubmitting ? "Creating..." : "Create Store"}
        </button>
      </form>
    </section>
  );
}
