// /src/app/layout.tsx

import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import MobileMenu from "../components/MobileMenu";
import MobileTabBar from "@/components/MobileTabBar";
import BackNavigationHandler from "@/components/BackNavigationHandler";
import FeedbackButton from "@/components/FeedbackButton";
import NavigationTimingTracker from "@/components/NavigationTimingTracker";
import ThemeController from "@/components/ThemeController";
import GA4Tracker from "@/components/GA4Tracker";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import LegalFooter from "@/components/LegalFooter";
import { clerkAppearance } from "@/lib/clerkAppearance";

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
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isMetricsView = pathname.startsWith("/studio/metrics");
  const isAuthFlowView =
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");
  const mainClassName = isMetricsView
    ? "no-scrollbar touch-pan-y [-webkit-overflow-scrolling:touch] flex-1 px-1 py-6 overflow-y-auto bg-[var(--bg-content)]"
    : isAuthFlowView
    ? "no-scrollbar touch-pan-y [-webkit-overflow-scrolling:touch] flex-1 px-1 py-6 overflow-y-auto bg-[var(--bg-content)]"
    : "no-scrollbar touch-pan-y [-webkit-overflow-scrolling:touch] flex-1 md:ml-64 px-1 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)] overflow-y-auto bg-[var(--bg-content)]";

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
          {!isMetricsView && !isAuthFlowView ? (
            <>
              {/* Sidebar (desktop) */}
              <aside className="hidden md:flex md:w-64 bg-[var(--bg-sidebar)] fixed top-0 left-0 bottom-0 z-20">
                <Sidebar />
              </aside>

              <MobileMenu />
              <ThemeController />
              <BackNavigationHandler />
            </>
          ) : null}
          {!isAuthFlowView ? (
            <>
              <Suspense fallback={null}>
                <GA4Tracker />
              </Suspense>
              <Suspense fallback={null}>
                <NavigationTimingTracker />
              </Suspense>
            </>
          ) : null}

          {/* Main content scrollable */}
          <main className={mainClassName}>
            {children}
          </main>
          <LegalFooter />
          <CookieConsentBanner />

          {!isMetricsView && !isAuthFlowView ? (
            <>
              <MobileTabBar />
              <FeedbackButton />
            </>
          ) : null}
        </body>
      </html>
    </ClerkProvider>
  );
}
