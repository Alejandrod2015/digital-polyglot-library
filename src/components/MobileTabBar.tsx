"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brain, Compass, Home, LogIn, Settings, Sparkles, Star } from "lucide-react";
import { useUser } from "@clerk/nextjs";

type Plan = "free" | "basic" | "premium" | "polyglot";

function isStoryReaderPath(pathname: string): boolean {
  const isBookStory = /^\/books\/[^/]+\/[^/]+$/.test(pathname);
  const isPolyglotStory = /^\/stories\/[^/]+$/.test(pathname);
  return isBookStory || isPolyglotStory;
}

function isHiddenPath(pathname: string): boolean {
  if (pathname.startsWith("/studio")) return true;
  if (pathname.startsWith("/sign-in")) return true;
  if (pathname.startsWith("/sign-up")) return true;
  return false;
}

export default function MobileTabBar() {
  const pathname = usePathname() || "/";
  const { user } = useUser();
  const [practiceActive, setPracticeActive] = useState(false);
  const [onboardingTourTarget, setOnboardingTourTarget] = useState("");
  const isSignedIn = Boolean(user);
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";

  useEffect(() => {
    const readPracticeState = () => {
      if (typeof document === "undefined") return;
      setPracticeActive(document.body.dataset.practiceActive === "true");
    };

    readPracticeState();
    window.addEventListener("practice-session-visibility-change", readPracticeState);
    return () => {
      window.removeEventListener("practice-session-visibility-change", readPracticeState);
    };
  }, []);

  useEffect(() => {
    const readTourTarget = () => {
      if (typeof document === "undefined") return;
      setOnboardingTourTarget(document.body.dataset.onboardingTourTarget ?? "");
    };

    readTourTarget();
    window.addEventListener("dp-onboarding-tour-target-change", readTourTarget);
    return () => {
      window.removeEventListener("dp-onboarding-tour-target-change", readTourTarget);
    };
  }, []);

  if (isStoryReaderPath(pathname) || isHiddenPath(pathname) || practiceActive) return null;

  const tabs = isSignedIn
    ? plan === "polyglot"
      ? [
          { href: "/", label: "Home", icon: Home },
          { href: "/explore", label: "Explore", icon: Compass },
          { href: "/practice", label: "Practice", icon: Brain },
          { href: "/favorites", label: "Favorites", icon: Star },
          { href: "/create", label: "Create", icon: Sparkles },
        ]
      : [
          { href: "/", label: "Home", icon: Home },
          { href: "/explore", label: "Explore", icon: Compass },
          { href: "/practice", label: "Practice", icon: Brain },
          { href: "/favorites", label: "Favorites", icon: Star },
          { href: "/settings", label: "Settings", icon: Settings },
        ]
    : [
        { href: "/", label: "Home", icon: Home },
        { href: "/explore", label: "Explore", icon: Compass },
        { href: "/practice", label: "Practice", icon: Brain },
        { href: "/favorites", label: "Favorites", icon: Star },
        { href: "/sign-in", label: "Sign in", icon: LogIn },
      ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur">
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                data-tour-target={
                  tab.label === "Home"
                    ? "home"
                    : tab.label === "Explore"
                      ? "explore"
                      : tab.label === "Practice" || tab.label === "Favorites"
                        ? "practice-favorites"
                        : undefined
                }
                className={`flex flex-col items-center justify-center py-2.5 text-[11px] transition-colors ${
                  active ? "text-[var(--nav-text)]" : "text-[var(--nav-text-muted)] hover:text-[var(--nav-text)]"
                } ${
                  (tab.label === "Home" && onboardingTourTarget === "home") ||
                  (tab.label === "Explore" && onboardingTourTarget === "explore") ||
                  ((tab.label === "Practice" || tab.label === "Favorites") &&
                    onboardingTourTarget === "practice-favorites")
                    ? "rounded-xl border border-[var(--primary)]/45 bg-[var(--primary)]/12 shadow-[0_0_0_1px_rgba(163,230,53,0.15)]"
                    : ""
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                <span className="mt-1">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
