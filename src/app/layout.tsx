// /src/app/layout.tsx

import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { clerkAppearance } from "@/lib/clerkAppearance";
import AppShell from "@/components/AppShell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1e36",
};

export const metadata: Metadata = {
  title: "Digital Polyglot",
  description: "Library of stories with audio",
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon.ico" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentVersion =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    "dev-local";

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={clerkAppearance}
    >
      <html lang="en" className="bg-[var(--bg-content)]">
        <head>
          <meta name="theme-color" content="#0b1e36" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="black-translucent"
          />
        </head>

        {/* ✅ layout estable: usa min-h-screen, no h-screen */}
        <body className="bg-[var(--bg-content)] text-[var(--foreground)] min-h-screen flex flex-col pt-[env(safe-area-inset-top)]">
          <AppShell currentVersion={currentVersion}>{children}</AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
