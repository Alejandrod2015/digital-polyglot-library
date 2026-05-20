"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Sidebar from "../components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import InstallAppHint from "@/components/InstallAppHint";
import BackNavigationHandler from "@/components/BackNavigationHandler";
import FeedbackButton from "@/components/FeedbackButton";
import NavigationTimingTracker from "@/components/NavigationTimingTracker";
import ThemeController from "@/components/ThemeController";
import GA4Tracker from "@/components/GA4Tracker";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import ServiceWorkerBootstrap from "@/components/ServiceWorkerBootstrap";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { StreakCelebration } from "@/components/StreakCelebration";

type AppShellProps = {
  children: React.ReactNode;
  currentVersion: string;
  initialIsSignedIn: boolean;
};

export default function AppShell({
  children,
  currentVersion,
  initialIsSignedIn,
}: AppShellProps) {
  const pathname = usePathname() ?? "";
  const { isSignedIn: clientIsSignedIn, isLoaded } = useAuth();
  // Use the server-resolved auth state until Clerk hydrates on the client.
  // This avoids flashing the signed-in chrome on the marketing home for
  // unauthenticated visitors.
  const isSignedIn = isLoaded ? clientIsSignedIn : initialIsSignedIn;
  const isStudioView = pathname.startsWith("/studio");
  const isMarketingView =
    (pathname === "/" && !isSignedIn) ||
    pathname.startsWith("/beta") ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/");
  const isAuthFlowView =
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/mobile-auth") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");

  if (isMarketingView) {
    return <>{children}</>;
  }

  if (isAuthFlowView) {
    return (
      <main className="no-scrollbar touch-pan-y [-webkit-overflow-scrolling:touch] flex-1 px-1 py-6 overflow-y-auto bg-[var(--bg-content)]">
        {children}
      </main>
    );
  }

  if (isStudioView) {
    return <>{children}</>;
  }

  const mainClassName =
    "no-scrollbar touch-pan-y [-webkit-overflow-scrolling:touch] flex-1 md:ml-64 px-1 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)] overflow-y-auto bg-[var(--bg-content)]";

  return (
    <>
      <>
        <aside className="hidden md:flex md:w-64 bg-[var(--bg-sidebar)] fixed top-0 left-0 bottom-0 z-20">
          <Sidebar />
        </aside>

        <ThemeController />
        <ServiceWorkerBootstrap currentVersion={currentVersion} />
        <BackNavigationHandler />
        <OfflineIndicator />
        <StreakCelebration />
      </>

      <Suspense fallback={null}>
        <GA4Tracker />
      </Suspense>
      <Suspense fallback={null}>
        <NavigationTimingTracker />
      </Suspense>

      <main className={mainClassName}>
        {children}
      </main>
      <CookieConsentBanner />

      <>
        <InstallAppHint />
        <MobileTabBar />
        <FeedbackButton />
      </>
    </>
  );
}
