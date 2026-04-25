import { useState } from "react";
import { BusinessSelectionDialog } from "../../design-system/organisms/BusinessSelectionDialog";
import { LoginCard } from "../../design-system/organisms/LoginCard";
import { useLoginFlow } from "../../features/auth/useLoginFlow";

export function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
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
        phoneNumber={phoneNumber}
        password={password}
        loading={loading}
        error={error}
        onPhoneNumberChange={setPhoneNumber}
        onPasswordChange={setPassword}
        onSubmit={(event) => {
          event.preventDefault();
          void submit({ phoneNumber, password });
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
