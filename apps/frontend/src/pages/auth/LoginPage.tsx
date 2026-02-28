import { useState } from "react";
import { BusinessSelectionDialog } from "../../design-system/organisms/BusinessSelectionDialog";
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
        <BusinessSelectionDialog
          title="Select Business"
          businesses={pendingBusinesses}
          query={businessSearch}
          onQueryChange={setBusinessSearch}
          onClose={cancelPendingBusinessSelection}
          onSelectBusiness={(businessId) => {
            void selectPendingBusiness(businessId);
          }}
          disabled={selectingBusiness}
          error={error}
          inactiveLabel="Tap to continue"
          overlayClassName="z-[90] bg-slate-950/45"
        />
      ) : null}
    </main>
  );
}
