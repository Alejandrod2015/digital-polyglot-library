"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  Compass,
  Star,
  BookMarked,
  ChartNoAxesColumn,
  Brain,
  Settings,
  LogIn,
  LogOut,
  Sparkles,
  Crown,
  Map,
} from "lucide-react";
import {
  SignedIn,
  SignedOut,
  SignOutButton,
  UserButton,
  useUser,
  useClerk,
} from "@clerk/nextjs";
import { clerkAppearance } from "../lib/clerkAppearance";
import StreakCard from "@/components/StreakCard";

type Plan = "free" | "basic" | "premium" | "polyglot";

interface SidebarProps {
  onClose?: () => void;
}

function PlanBadge({ inline = false }: { inline?: boolean } = {}) {
  const { user } = useUser();
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";
  // Plan badge: blue chip per handoff v2 spec for all plans
  // (rgba(37,99,235,0.30) bg + #bfdbfe text). Premium/polyglot keep
  // the blue look in the profile row to match the mockup; the plan
  // identity is conveyed via Clerk metadata, not via badge colour.
  return (
    <span
      className={`${inline ? "" : "ml-auto "}inline-flex w-fit items-center rounded-[5px] bg-blue-600/30 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-blue-200`}
      title={`Plan: ${plan}`}
    >
      {plan}
    </span>
  );
}

function SignInButtonCustom({ onClose }: { onClose?: () => void }) {
  const { openSignIn } = useClerk();
  const pathname = usePathname();

  const handleClick = () => {
    if (typeof onClose === "function") onClose();
    const redirectTarget = pathname && pathname !== "/auth/post-login" ? pathname : "/";
    openSignIn({
      appearance: clerkAppearance,
      fallbackRedirectUrl: redirectTarget,
      forceRedirectUrl: redirectTarget,
    });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--chip-border)] bg-[var(--chip-bg)] hover:opacity-90 px-3 py-2 text-sm font-medium text-[var(--foreground)]"
    >
      <LogIn className="h-4 w-4" />
      Sign in
    </button>
  );
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user } = useUser();
  const pathname = usePathname();
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";
  const [onboardingTourTarget, setOnboardingTourTarget] = useState("");
  const [reviewDueCount, setReviewDueCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/favorites");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;
        const now = Date.now();
        const dueCount = data.filter((item: { dueAt?: string | null }) => {
          if (!item?.dueAt) return false;
          const dueAt = new Date(item.dueAt).getTime();
          return Number.isFinite(dueAt) && dueAt <= now;
        }).length;
        setReviewDueCount(dueCount);
      } catch {
        // non-blocking
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/progress");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const value =
          typeof data?.practiceStreakDays === "number"
            ? data.practiceStreakDays
            : typeof data?.streakDays === "number"
              ? data.streakDays
              : 0;
        setStreakDays(value);
      } catch {
        // non-blocking
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isActiveRoute = (href: string) => {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const trackUpgradeCta = async (source: string) => {
    try {
      await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storySlug: `__upgrade_${source}__`,
          bookSlug: "__plans__",
          eventType: "upgrade_cta_clicked",
        }),
      });
    } catch {
      // noop
    }
  };

  const handleNavClick = () => {
    if (typeof onClose === "function") onClose();
  };

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

  const navLinkClass =
    "flex items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-[15px] font-bold text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--foreground)] transition-colors";

  // `dp-nav-active` es un marker class; Tailwind solo no llega: en
  // light mode `globals.css` lo usa para reemplazar el bg-gold/18 por
  // una píldora blanca con shadow (paper-card treatment del HANDOFF 2).
  const navLinkActiveClass =
    "dp-nav-active flex items-center gap-3.5 rounded-[10px] bg-[color:var(--color-gold)]/[0.18] px-3 py-2.5 text-[15px] font-bold text-[var(--foreground)] [&_svg]:text-[var(--color-gold)] transition-colors";

  const linkClass = (href: string) => (isActiveRoute(href) ? navLinkActiveClass : navLinkClass);

  const navLinkHighlight = (target: string) =>
    onboardingTourTarget === target
      ? "rounded-xl border border-[color:var(--color-gold)]/45 bg-[color:var(--color-gold)]/12 px-3 py-2 text-[var(--nav-text)] shadow-[0_0_0_1px_rgba(252,211,77,0.18)]"
      : "";

  return (
    <div className="flex h-full w-full flex-col gap-5 overflow-y-auto bg-[var(--bg-sidebar)] px-5 py-6 text-[var(--foreground)]">
      {/* Logo. Use width/height that match the natural aspect ratio of the
          PNG (916x432 ≈ 2.12:1) so the image doesn't get distorted into a
          square and crowd the nav items below. */}
      <div className="mb-2 flex justify-center">
        <Link href="/" onClick={handleNavClick} className="block">
          <Image
            src="/digital-polyglot-logo.png"
            alt="Digital Polyglot"
            width={160}
            height={76}
            priority
            className="dp-logo-dark h-auto w-[160px]"
          />
          <Image
            src="/digital-polyglot-logo-light.png"
            alt="Digital Polyglot"
            width={160}
            height={76}
            priority
            className="dp-logo-light h-auto w-[160px]"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5">
        <Link
          href="/"
          onClick={handleNavClick}
          data-tour-target="home"
          className={`${linkClass("/")} ${navLinkHighlight("home")}`}
        >
          <Home size={20} /> Home
        </Link>

        {/* Journey: solo visible para Premium. Polyglot ya ve Journey
            como su Home (paridad con mobile, donde no existe entrada
            separada para Polyglot), así que la entrada extra acá
            sería redundante. Free/basic siguen sin verla. */}
        {plan === "premium" && (
          <Link
            href="/journey"
            onClick={handleNavClick}
            data-tour-target="journey"
            className={`${linkClass("/journey")} ${navLinkHighlight("journey")}`}
          >
            <Map size={20} /> Journey
          </Link>
        )}

        <Link
          href="/explore"
          onClick={handleNavClick}
          data-tour-target="explore"
          className={`${linkClass("/explore")} ${navLinkHighlight("explore")}`}
        >
          <Compass size={20} /> Explore
        </Link>

        <Link
          href="/practice"
          onClick={handleNavClick}
          data-tour-target="practice-favorites"
          className={`${linkClass("/practice")} ${navLinkHighlight("practice-favorites")}`}
        >
          <Brain size={20} /> Practice
          {reviewDueCount > 0 ? (
            <span className="ml-auto inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-[var(--color-gold)] px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
              {reviewDueCount}
            </span>
          ) : null}
        </Link>

        <Link
          href="/my-library"
          onClick={handleNavClick}
          className={linkClass("/my-library")}
        >
          <BookMarked size={20} /> My Library
        </Link>

        <Link
          href="/favorites"
          onClick={handleNavClick}
          data-tour-target="practice-favorites"
          className={`${linkClass("/favorites")} ${navLinkHighlight("practice-favorites")}`}
        >
          <Star size={20} /> Favorites
        </Link>

        <Link
          href="/progress"
          onClick={handleNavClick}
          className={linkClass("/progress")}
        >
          <ChartNoAxesColumn size={20} /> Progress
        </Link>

        {/* Polyglot plan only */}
        {plan === "polyglot" && (
          <Link
            href="/create"
            onClick={handleNavClick}
            className={linkClass("/create")}
          >
            <Sparkles size={20} /> Create
          </Link>
        )}

        {/* Story of the day/week gating:
            - free  → solo "Story of the Week" (su unlock weekly)
            - basic / premium → solo "Story of the Day" (paid, no necesitan weekly)
            - polyglot → AMBOS (acceso total, ve las dos versiones) */}
        {plan !== "free" && (
          <Link
            href="/story-of-the-day"
            onClick={handleNavClick}
            className={linkClass("/story-of-the-day")}
          >
            <BookMarked size={20} /> Story of the Day
          </Link>
        )}
        {(plan === "free" || plan === "polyglot") && (
          <Link
            href="/story-of-the-week"
            onClick={handleNavClick}
            className={linkClass("/story-of-the-week")}
          >
            <BookMarked size={20} /> Story of the Week
          </Link>
        )}

        {(!user || plan === "free" || plan === "basic") && (
          <Link
            href="/plans"
            onClick={handleNavClick}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-[color:var(--color-gold)] hover:bg-[color:var(--color-gold)]/10 transition-colors"
          >
            <Crown size={20} /> Upgrade
          </Link>
        )}

        <Link
          href="/settings"
          onClick={handleNavClick}
          className={linkClass("/settings")}
        >
          <Settings size={20} /> Settings
        </Link>
      </nav>

      {/* Streak card; always visible (paridad iPhone). Logged-out users
          see a zero-state "Start today to begin a streak". Logged-in users
          see their real count from /api/me/streak. */}
      <StreakCard days={streakDays} />

      {/* Auth controls */}
      <div className="mt-6 space-y-3">
        <SignedOut>
          <SignInButtonCustom onClose={onClose} />
        </SignedOut>

        <SignedIn>
          <div className="flex items-center gap-2.5 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] p-2">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox:
                    "h-8 w-8 bg-gradient-to-br from-indigo-500 to-blue-500",
                },
              }}
            />
            <div className="flex min-w-0 flex-1 flex-col leading-[1.2]">
              <span className="truncate text-[13.5px] font-bold text-[var(--foreground)]">
                {user?.firstName?.trim() || user?.username || "You"}
              </span>
              <PlanBadge inline />
            </div>
            <SignOutButton>
              <button
                onClick={onClose}
                aria-label="Sign out"
                title="Sign out"
                className="ml-auto inline-grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-white/[0.06] hover:text-[var(--foreground)]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </SignOutButton>
          </div>
        </SignedIn>

        <div className="border-t border-[var(--nav-border)] pt-3 text-[11px] text-[var(--nav-text-muted)]/80">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/impressum" onClick={handleNavClick} className="hover:text-[var(--nav-text)]">
              Impressum
            </Link>
            <Link href="/privacy" onClick={handleNavClick} className="hover:text-[var(--nav-text)]">
              Privacy
            </Link>
            <Link href="/cookies" onClick={handleNavClick} className="hover:text-[var(--nav-text)]">
              Cookies
            </Link>
            <Link href="/terms" onClick={handleNavClick} className="hover:text-[var(--nav-text)]">
              Terms
            </Link>
            <Link href="/data-deletion" onClick={handleNavClick} className="hover:text-[var(--nav-text)]">
              Data deletion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
