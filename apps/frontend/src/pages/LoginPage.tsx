import { useState } from "react";
import { LoginCard } from "../design-system/organisms/LoginCard";
import { useLoginFlow } from "../features/auth/useLoginFlow";

export function LoginPage() {
  const [username, setUsername] = useState("5551234567");
  const [password, setPassword] = useState("ChangeMe123!");
  const { loading, submit, error } = useLoginFlow();

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
    </main>
  );
}
