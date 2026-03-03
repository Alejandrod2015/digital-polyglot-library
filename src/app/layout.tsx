// /src/app/layout.tsx

import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import MobileMenu from "../components/MobileMenu";
import MobileTabBar from "@/components/MobileTabBar";
import BackNavigationHandler from "@/components/BackNavigationHandler";
import FeedbackButton from "@/components/FeedbackButton";
import NavigationTimingTracker from "@/components/NavigationTimingTracker";
import "../../sentry.client.config";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
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
          {/* Sidebar (desktop) */}
          <aside className="hidden md:flex md:w-64 bg-[var(--bg-sidebar)] fixed top-0 left-0 bottom-0 z-20">
            <Sidebar />
          </aside>

          <MobileMenu />
          <BackNavigationHandler />
          <Suspense fallback={null}>
            <NavigationTimingTracker />
          </Suspense>

          {/* Main content scrollable */}
          <main className="no-scrollbar touch-pan-y [-webkit-overflow-scrolling:touch] flex-1 md:ml-64 px-1 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)] overflow-y-auto bg-[var(--bg-content)]">
            {children}
          </main>

          <MobileTabBar />
          <FeedbackButton />
        </body>
      </html>
    </ClerkProvider>
  );
}
