import { cookies } from "next/headers";
import AdminStoreOnboardingCard from "./admin-store-onboarding-card";
import AdminStoreOwnersCard from "./admin-store-owners-card";
import { ACCESS_TOKEN_COOKIE, readAccessToken } from "@/features/auth/server";
import { SystemRole } from "@/generated/prisma/enums";

const UserHome = () => (
  <div className="grid gap-4 pb-4">
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">Today</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">
        Core PWA shell is active. Your sync scheduler and service worker run in the background.
      </p>
    </section>

    <section className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sync</p>
        <p className="mt-2 text-lg font-semibold">Running</p>
      </article>
      <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Connection</p>
        <p className="mt-2 text-lg font-semibold">Online First</p>
      </article>
    </section>
  </div>
);

const AdminHome = () => (
  <div className="grid gap-4 pb-4">
    <AdminStoreOnboardingCard />
    <AdminStoreOwnersCard />
  </div>
);

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const payload = token ? await readAccessToken(token) : null;

  if (payload?.systemRole === SystemRole.PLATFORM_ADMIN) {
    return <AdminHome />;
  }

  return <UserHome />;
}
