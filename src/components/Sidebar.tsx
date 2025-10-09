"use client";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  Star,
  Gift,
  BookMarked,
  Settings,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  SignedIn,
  SignedOut,
  SignOutButton,
  UserButton,
  useUser,
  useClerk,
} from "@clerk/nextjs";

type Plan = "free" | "premium" | "polyglot";

interface SidebarProps {
  onClose?: () => void;
}

function PlanBadge() {
  const { user } = useUser();
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";
  const styles: Record<Plan, string> = {
    free: "bg-gray-700/60 text-gray-200",
    premium: "bg-yellow-600/30 text-yellow-200",
    polyglot: "bg-emerald-600/30 text-emerald-200",
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
      afterSignInUrl: "/books",
      afterSignUpUrl: "/books",
    });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-medium"
    >
      <LogIn className="h-4 w-4" />
      Sign in
    </button>
  );
}

export default function Sidebar({ onClose }: SidebarProps) {
  return (
    <div className="flex flex-col h-full w-full bg-[#0B132B] text-white p-6">
      {/* Logo */}
      <div className="mb-5 flex justify-center">
        <Link href="/" onClick={onClose}>
          <Image
            src="/digital-polyglot-logo.png" // asegúrate de que está en /public
            alt="Digital Polyglot"
            width={180}   // 👈 ajusta el tamaño
            height={180}
            priority
          />
        </Link>
      </div>

      {/* Navegación */}
      <nav className="flex flex-col space-y-6 text-lg font-medium">
        <Link
          href="/books"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-blue-400 transition-colors"
        >
          <BookOpen size={22} /> Books
        </Link>

        <Link
          href="/favorites"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-yellow-400 transition-colors"
        >
          <Star size={22} /> Favorites
        </Link>

        {/*
  🚫 Deprecated link — freebies page moved to /deprecated
  <Link
    href="/freebies"
    onClick={onClose}
    className="flex items-center gap-3 hover:text-green-400 transition-colors"
  >
    <Gift size={22} /> Freebies
  </Link>
*/}


        <Link
          href="/story-of-the-day"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-pink-400 transition-colors"
        >
          <BookMarked size={22} /> Story of the Day
        </Link>

        <Link
          href="/settings"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-gray-400 transition-colors"
        >
          <Settings size={22} /> Settings
        </Link>
      </nav>

      {/* Auth controls (añadido) */}
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-medium"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </SignOutButton>
        </SignedIn>
      </div>

      {/* Footer */}
      <div className="mt-auto text-xs text-gray-400">
        © {new Date().getFullYear()} Digital Polyglot
      </div>
    </div>
  );
}
