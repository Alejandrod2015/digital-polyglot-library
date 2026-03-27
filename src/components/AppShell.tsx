"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../components/Sidebar";
import MobileMenu from "../components/MobileMenu";
import MobileTabBar from "@/components/MobileTabBar";
import BackNavigationHandler from "@/components/BackNavigationHandler";
import FeedbackButton from "@/components/FeedbackButton";
import NavigationTimingTracker from "@/components/NavigationTimingTracker";
import ThemeController from "@/components/ThemeController";
import GA4Tracker from "@/components/GA4Tracker";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import ServiceWorkerBootstrap from "@/components/ServiceWorkerBootstrap";

type AppShellProps = {
  children: React.ReactNode;
  currentVersion: string;
};

export default function AppShell({ children, currentVersion }: AppShellProps) {
  const pathname = usePathname() ?? "";
  const isStudioView = pathname.startsWith("/studio");
  const isAuthFlowView =
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/mobile-auth") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");

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

        <MobileMenu />
        <ThemeController />
        <ServiceWorkerBootstrap currentVersion={currentVersion} />
        <BackNavigationHandler />
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
        <MobileTabBar />
        <FeedbackButton />
      </>
    </>
  );
}
