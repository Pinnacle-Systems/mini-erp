export function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6 md:p-10">
      <section className="w-full max-w-md rounded-xl border border-border/80 bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_16px_28px_-24px_rgba(15,23,42,0.2)]">
        <p className="m-0 text-sm font-semibold text-foreground">Mini ERP</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-foreground">
          You are offline
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Network connectivity is unavailable. Reconnect and try again.
        </p>
      </section>
    </main>
  );
}
