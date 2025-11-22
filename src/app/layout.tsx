// /src/app/layout.tsx

import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import MobileMenu from "../components/MobileMenu";
import BackNavigationHandler from "@/components/BackNavigationHandler";
import FeedbackButton from "@/components/FeedbackButton";
import "../../sentry.client.config";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
      <html lang="en" className="bg-[#121212]">
        <head>
          <meta name="theme-color" content="#0D1B2A" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="black-translucent"
          />
        </head>

        {/* ✅ layout estable: usa min-h-screen, no h-screen */}
        <body className="bg-[#121212] text-[#E0E0E0] min-h-screen flex flex-col">
          {/* Sidebar (desktop) */}
          <aside className="hidden md:flex md:w-64 bg-[#0B132B] fixed top-0 left-0 bottom-0 z-20">
            <Sidebar />
          </aside>

          <MobileMenu />
          <BackNavigationHandler />

          {/* Main content scrollable */}
          <main className="flex-1 md:ml-64 px-1 py-6 pb-[env(safe-area-inset-bottom)] overflow-y-auto">
            {children}
          </main>

          <FeedbackButton />
        </body>
      </html>
    </ClerkProvider>
  );
}
