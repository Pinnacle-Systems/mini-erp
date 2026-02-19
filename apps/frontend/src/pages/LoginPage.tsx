import type { FormEvent } from "react";
import { LoginCard } from "../design-system/organisms/LoginCard";

type LoginPageProps = {
  username: string;
  password: string;
  loading: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function LoginPage({
  username,
  password,
  loading,
  onUsernameChange,
  onPasswordChange,
  onSubmit
}: LoginPageProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6 md:p-10">
      <LoginCard
        username={username}
        password={password}
        loading={loading}
        onUsernameChange={onUsernameChange}
        onPasswordChange={onPasswordChange}
        onSubmit={onSubmit}
      />
    </main>
  );
}
