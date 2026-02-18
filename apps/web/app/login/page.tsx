"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { writeAuthCache } from "@/features/auth/client/state";
import { clearStoreContext } from "@/features/auth/client/store-context";

type LoginResponse = {
  success: boolean;
  message?: string;
  token?: string;
  role?: string;
};

const toLoginBody = (identifier: string, password: string) => {
  const trimmed = identifier.trim();
  const digitsOnly = /^\d{10}$/.test(trimmed);

  if (digitsOnly) {
    return { phone: trimmed, password };
  }

  return { email: trimmed, password };
};

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!identifier.trim() || !password) {
      setError("Enter email/phone and password.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toLoginBody(identifier, password)),
      });

      const payload = (await response.json()) as LoginResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Login failed");
      }

      writeAuthCache(true);
      clearStoreContext();
      if (payload.role === "USER") {
        router.replace("/store-selection");
      } else {
        router.replace("/");
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to sign in.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use your email or 10-digit phone number.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Email or phone</span>
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none ring-0 transition focus:border-slate-400"
              placeholder="you@company.com"
              disabled={isSubmitting}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none ring-0 transition focus:border-slate-400"
              placeholder="••••••••"
              disabled={isSubmitting}
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            className="h-11 rounded-xl bg-slate-900 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
