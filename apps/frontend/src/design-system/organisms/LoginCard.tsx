import { motion } from "framer-motion";
import { Button } from "../atoms/Button";
import { Label } from "../atoms/Label";
import { Input } from "../atoms/Input";
import { LoadingOverlay } from "../atoms/LoadingOverlay";
import { Card, CardContent } from "../molecules/Card";
import type { FormEvent } from "react";

type LoginCardProps = {
  phoneNumber: string;
  password: string;
  loading: boolean;
  error: string | null;
  onPhoneNumberChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function LoginCard({
  phoneNumber,
  password,
  loading,
  error,
  onPhoneNumberChange,
  onPasswordChange,
  onSubmit
}: LoginCardProps) {
  const handlePhoneNumberChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    onPhoneNumberChange(digitsOnly);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="relative max-w-md overflow-hidden p-0">
        <CardContent className="space-y-5 p-6 md:p-7">
          <div>
            <p className="text-sm font-medium tracking-[0.01em] text-muted-foreground">
              Mini ERP
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.01em] text-foreground">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to continue to your workspace.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone number</Label>
              <Input
                id="phone-number"
                type="text"
                autoComplete="tel"
                inputMode="tel"
                value={phoneNumber}
                onChange={(event) => handlePhoneNumberChange(event.target.value)}
                placeholder="10-digit phone number"
              />
              <p className="text-xs text-muted-foreground">
                Phone login uses 10 digits without country code.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
            >
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </motion.div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </form>
        </CardContent>
        <LoadingOverlay visible={loading} label="Signing in" />
      </Card>
    </motion.div>
  );
}
