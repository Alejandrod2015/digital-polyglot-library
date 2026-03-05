"use client";
import Link from "next/link";
import Image from "next/image";
import {
  Home,
  Compass,
  Star,
  BookOpen,
  BookMarked,
  ChartNoAxesColumn,
  Settings,
  LogIn,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  SignedIn,
  SignedOut,
  SignOutButton,
  UserButton,
  useUser,
  useClerk,
} from "@clerk/nextjs";

type Plan = "free" | "basic" | "premium" | "polyglot";

interface SidebarProps {
  onClose?: () => void;
}

function PlanBadge() {
  const { user } = useUser();
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";
  const styles: Record<Plan, string> = {
    free: "bg-[var(--chip-bg)] text-[var(--chip-text)]",
    basic: "bg-blue-600/30 text-blue-200",
    premium: "bg-[var(--chip-bg)] text-[var(--chip-text)]",
    polyglot: "bg-[var(--chip-bg)] text-[var(--chip-text)]",
  };
  return (
    <span
      className={`ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${styles[plan]}`}
      title={`Plan: ${plan}`}
    >
      {plan}
    </span>
  );
}

function SignInButtonCustom({ onClose }: { onClose?: () => void }) {
  const { openSignIn } = useClerk();

  const handleClick = () => {
    if (typeof onClose === "function") onClose();
    openSignIn({
      appearance: { layout: { shimmer: true } },
      afterSignInUrl: "/auth/post-login",
      afterSignUpUrl: "/auth/post-login",
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
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";

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

  const navLinkClass =
    "flex items-center gap-3 text-[var(--nav-text-muted)] hover:text-[var(--nav-text)] transition-colors";

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-sidebar)] text-[var(--foreground)] p-6">
      {/* Logo */}
      <div className="mb-5 flex justify-center">
        <Link href="/" onClick={handleNavClick}>
          <Image
            src="/digital-polyglot-logo.png"
            alt="Digital Polyglot"
            width={180}
            height={180}
            priority
            className="dp-logo-dark"
          />
          <Image
            src="/digital-polyglot-logo-light.png"
            alt="Digital Polyglot"
            width={180}
            height={180}
            priority
            className="dp-logo-light"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col space-y-6 text-lg font-medium">
        <Link
          href="/"
          onClick={handleNavClick}
          className={navLinkClass}
        >
          <Home size={22} /> Home
        </Link>

        <Link
          href="/explore"
          onClick={handleNavClick}
          className={navLinkClass}
        >
          <Compass size={22} /> Explore
        </Link>

        <Link
          href="/my-library"
          onClick={handleNavClick}
          className={navLinkClass}
        >
          <BookOpen size={22} /> My Library
        </Link>

        <Link
          href="/favorites"
          onClick={handleNavClick}
          className={navLinkClass}
        >
          <Star size={22} /> Favorites
        </Link>

        <Link
          href="/progress"
          onClick={handleNavClick}
          className={navLinkClass}
        >
          <ChartNoAxesColumn size={22} /> Progress
        </Link>

        {(plan === "free" || plan === "basic") && (
          <Link
            href="/plans"
            onClick={() => {
              void trackUpgradeCta("sidebar");
              handleNavClick();
            }}
            className="flex items-center gap-3 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Sparkles size={22} /> Upgrade
          </Link>
        )}

        {/* Polyglot plan only */}
        {plan === "polyglot" && (
          <Link
            href="/create"
            onClick={handleNavClick}
            className={navLinkClass}
          >
            <Sparkles size={22} /> Create
          </Link>
        )}

        {/* Free / Basic plan special stories */}
        {plan === "free" && (
          <Link
            href="/story-of-the-week"
            onClick={handleNavClick}
            className={navLinkClass}
          >
            <BookMarked size={22} /> Story of the Week
          </Link>
        )}

        {plan === "basic" && (
          <Link
            href="/story-of-the-day"
            onClick={handleNavClick}
            className={navLinkClass}
          >
            <BookMarked size={22} /> Story of the Day
          </Link>
        )}

        <Link
          href="/settings"
          onClick={handleNavClick}
          className={navLinkClass}
        >
          <Settings size={22} /> Settings
        </Link>
      </nav>

      {/* Auth controls */}
      <div className="mt-8 space-y-3">
        <SignedOut>
          <SignInButtonCustom onClose={onClose} />
        </SignedOut>

        <SignedIn>
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "h-7 w-7" } }} />
            <PlanBadge />
          </div>
          <SignOutButton>
            <button
              onClick={onClose}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--chip-border)] bg-[var(--chip-bg)] hover:opacity-90 px-3 py-2 text-sm font-medium text-[var(--foreground)]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </SignOutButton>
        </SignedIn>
      </div>
    </div>
  );
}
