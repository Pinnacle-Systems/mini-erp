import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { SerwistProvider } from "./serwist";
import SyncBootstrap from "./sync-bootstrap";
import AppShell from "./app-shell";
import ClientAuthGate from "./client-auth-gate";
import { readAccessToken, ACCESS_TOKEN_COOKIE } from "@/features/auth/server";

const APP_NAME = "PWA App";
const APP_DEFAULT_TITLE = "My Awesome PWA App";
const APP_TITLE_TEMPLATE = "%s - PWA App";
const APP_DESCRIPTION = "Best PWA app in the world!";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
    // startUpImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const shouldEnableSync = Boolean(token && (await readAccessToken(token)));

  return (
    <html lang="en" dir="ltr">
      <head />
      <body className="min-h-dvh">
        <SerwistProvider
          swUrl="/sw.js" /* disable={process.env.NODE_ENV === "development"} */
        >
          <ClientAuthGate>
            <SyncBootstrap enabled={shouldEnableSync} />
            <AppShell>{children}</AppShell>
          </ClientAuthGate>
        </SerwistProvider>
      </body>
    </html>
  );
}
