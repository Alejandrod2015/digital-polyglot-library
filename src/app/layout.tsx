// /src/app/layout.tsx

import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono, Nunito } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { isConsentOptInCountry } from "@/lib/geo";
import AppShell from "@/components/AppShell";
import VisitLogger from "@/components/VisitLogger";

// Nunito as the primary UI font. `variable` exposes it as a CSS custom
// property (consumed in globals.css via `var(--font-nunito)`), and
// `display: "swap"` avoids the invisible-text-while-loading flash.
// Weight list cubre todos los pesos que el codebase usa de verdad:
// 400 (body fallback), 500 (font-medium), 600 (font-semibold — usado
// en 236 lugares), 700 (font-bold), 800 (font-extrabold), 900
// (font-black). Antes faltaban 500 y 600, y el browser caía a Arial
// system para esos pesos → el menú lateral se veía con otra fuente
// que el resto.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

// Inter + JetBrains Mono são las fuentes editoriales de /studio/metrics.
// El handoff las define como load-bearing para legibilidad analítica
// (tabular-nums + tight letter-spacing). Se exponen como vars y se
// aplican solo dentro de `.mx-root` para no afectar al resto del app.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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

  // Resolve auth on the server so AppShell can render the right shell
  // (sidebar+tabbar for signed-in, plain marketing chrome for guests)
  // without a flash before Clerk hydrates on the client.
  const { userId } = await auth();
  const initialIsSignedIn = Boolean(userId);

  // Geo-gate analytics consent: EEA/UK/CH require explicit opt-in, the rest
  // (mostly US blog traffic) defaults to analytics-on with opt-out. Vercel
  // resolves the visitor country at the edge into x-vercel-ip-country.
  const country = (await headers()).get("x-vercel-ip-country");
  const requiresConsentOptIn = isConsentOptInCountry(country);

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={clerkAppearance}
    >
      <html
        lang="en"
        className={`${nunito.variable} ${inter.variable} ${jetbrainsMono.variable} bg-[var(--bg-content)]`}
      >
        <head>
          <meta name="theme-color" content="#0b1e36" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="black-translucent"
          />
        </head>

        {/* ✅ layout estable: usa min-h-screen, no h-screen */}
        <body className="bg-[var(--bg-content)] text-[var(--foreground)] min-h-screen flex flex-col pt-[env(safe-area-inset-top)]">
          <AppShell
            currentVersion={currentVersion}
            initialIsSignedIn={initialIsSignedIn}
            requiresConsentOptIn={requiresConsentOptIn}
          >
            {children}
          </AppShell>
          {/* First-party visit logger. Suspense so useSearchParams
              doesn't force a CSR fallback on the whole tree. */}
          <Suspense fallback={null}>
            <VisitLogger />
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
