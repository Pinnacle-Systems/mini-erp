export default function Home() {
  return (
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
}
