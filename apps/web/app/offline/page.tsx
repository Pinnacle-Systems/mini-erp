export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">You are offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          The app shell is available, but this page needs a connection to refresh data.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Reconnect to the internet and refresh to continue.
        </p>
      </section>
    </main>
  );
}
