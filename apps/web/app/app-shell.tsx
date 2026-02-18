"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { writeAuthCache } from "@/features/auth/client/state";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Continue with local sign-out when offline/unreachable.
    } finally {
      writeAuthCache(false);
      router.replace("/login");
      router.refresh();
      setIsLoggingOut(false);
    }
  };

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

        const payload = (await response.json()) as {
          success: boolean;
          role?: string | null;
        };

        if (active && payload.success) {
          setRole(payload.role ?? null);
        }
      } catch {
        // Ignore role adornments if identity resolution fails.
      }
    };

    void loadMe();

    return () => {
      active = false;
    };
  }, []);

  if (pathname === "/login" || pathname === "/offline") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between px-3">
          <Link
            href="/"
            className="rounded-md px-2 py-1 text-sm font-semibold tracking-wide text-slate-900 transition hover:bg-slate-100"
          >
            Mini ERP
          </Link>
          <div className="flex items-center gap-2">
            {role === "PLATFORM_ADMIN" ? (
              <div className="rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white">
                Admin Console
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-center gap-2 px-3">
          <Link
            href="/"
            className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </nav>
    </div>
  );
}
