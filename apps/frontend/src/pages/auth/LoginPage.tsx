import { Search, X } from "lucide-react";
import { useState } from "react";
import { LoginCard } from "../../design-system/organisms/LoginCard";
import { useLoginFlow } from "../../features/auth/useLoginFlow";

export function LoginPage() {
  const [username, setUsername] = useState("5551234567");
  const [password, setPassword] = useState("ChangeMe123!");
  const [businessSearch, setBusinessSearch] = useState("");
  const {
    loading,
    submit,
    error,
    pendingBusinesses,
    selectingBusiness,
    selectPendingBusiness,
    cancelPendingBusinessSelection,
  } = useLoginFlow();
  const visibleBusinesses = pendingBusinesses?.filter((business) =>
    business.name.toLowerCase().includes(businessSearch.trim().toLowerCase()),
  ) ?? [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6 md:p-10">
      <LoginCard
        username={username}
        password={password}
        loading={loading}
        error={error}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSubmit={(event) => {
          event.preventDefault();
          void submit({ username, password });
        }}
      />
      {pendingBusinesses ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/45 p-3 sm:p-4">
          <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-white/70 bg-white p-3 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)] sm:mt-16">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Select Business</p>
              <button
                type="button"
                onClick={cancelPendingBusinessSelection}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#d7e2ef] bg-white text-foreground"
                disabled={selectingBusiness}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                value={businessSearch}
                onChange={(event) => setBusinessSearch(event.target.value)}
                placeholder="Search business"
                autoComplete="off"
                className="h-9 w-full rounded-md border border-[#c6d5e6] pl-8 pr-2 text-xs"
              />
            </div>
            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {visibleBusinesses.map((business) => (
                <button
                  key={business.id}
                  type="button"
                  onClick={() => void selectPendingBusiness(business.id)}
                  disabled={selectingBusiness}
                  className="w-full rounded-lg border border-[#e1ebf6] bg-white px-2 py-2 text-left transition hover:bg-[#f8fbff]"
                >
                  <p className="truncate text-xs font-medium text-foreground">{business.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Tap to continue
                  </p>
                </button>
              ))}
              {visibleBusinesses.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">No businesses found.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
