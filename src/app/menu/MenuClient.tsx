"use client";

// Menu screen client. Renderiza las 3 secciones (Your activity /
// Create / Account) como cards con icono + label + chevron a la
// derecha. Mismo look que iPhone: section eyebrow tracking-wide
// uppercase + grupo de rows agrupados visualmente.

import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  Bookmark,
  ChevronRight,
  Loader2,
  LogOut,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type Plan = "free" | "basic" | "premium" | "polyglot";

type Props = { plan: Plan };

type RowProps = {
  icon: LucideIcon;
  label: string;
  accent: string;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
};

function MenuRow({ icon: Icon, label, accent, href, onClick, trailing }: RowProps) {
  // Tile interior común: icono circular tintado del accent + label
  // bold + chevron muted al final. Hover sutil para feedback.
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div
        className="grid place-items-center shrink-0"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: `${accent}1f`,
          color: accent,
        }}
      >
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <span className="flex-1 text-[15px] font-extrabold text-[var(--foreground)] truncate">
        {label}
      </span>
      {trailing ?? <ChevronRight size={18} className="text-[var(--muted)] shrink-0" />}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block hover:bg-[var(--card-bg-hover)] transition-colors"
      >
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left hover:bg-[var(--card-bg-hover)] transition-colors"
      >
        {inner}
      </button>
    );
  }
  return <div className="block">{inner}</div>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 mb-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--muted)]">
      {children}
    </p>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  // Grupo de rows: card padre con borde y divider sutil entre filas.
  // Antes usaba `divide-y` (Tailwind) que aplica un border de color
  // default fuerte; en light mode se veía como líneas casi negras.
  // Pasamos a class custom `dp-menu-section` cuya regla en
  // globals.css usa un alpha mínimo (5% black) que matchea la
  // sensación iOS de divider casi imperceptible.
  return (
    <div
      className="dp-menu-section rounded-[20px] border overflow-hidden"
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      {children}
    </div>
  );
}

export default function MenuClient({ plan }: Props) {
  const { user } = useUser();
  const router = useRouter();
  const [testModeRunning, setTestModeRunning] = useState(false);
  const showUpgrade = plan === "free" || plan === "basic";
  const showStoryOfWeek = plan === "free";
  const showStoryOfDay = plan === "basic";
  // Test mode (paridad iPhone): solo Polyglot. Resetea preferences
  // server-side (targetLanguages, level, region, variant, reminders,
  // onboarding flags) y manda al home en blanco. Confirmación previa
  // porque es destructivo.
  const showTestMode = plan === "polyglot";

  async function handleTestModeReset() {
    if (testModeRunning) return;
    const confirmed = window.confirm(
      "Test mode resets all your preferences (target languages, level, variant, region, reminders) and sends you back to the onboarding. Continue?"
    );
    if (!confirmed) return;
    setTestModeRunning(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguages: [],
          interests: [],
          preferredLevel: null,
          preferredRegion: null,
          preferredVariant: null,
          remindersEnabled: false,
          reminderHour: null,
          reminderMinute: null,
        }),
      });
      if (!res.ok) {
        throw new Error(`preferences reset failed: ${res.status}`);
      }
      // Refrescamos Clerk para que el next read de publicMetadata
      // tenga las prefs reseteadas. Si falla, seguimos al reload
      // porque la fuente de verdad es el server.
      try {
        await user?.reload();
      } catch {
        // ignore
      }
      // FULL reload (no `router.push`). Test mode es destructivo y
      // queremos garantizar que TODO cache server-side y client-side
      // arranca desde cero; RSC cache, useSWR, Clerk metadata,
      // todo. router.push() reusa el state, lo cual dejaba al user
      // viendo la pantalla previa (e.g. /studio) con datos stale.
      window.location.href = "/";
    } catch (err) {
      console.error("[test-mode-reset] failed:", err);
      window.alert("Test mode reset failed. Please try again.");
      setTestModeRunning(false);
    }
  }

  return (
    <div
      className="px-4 sm:px-8 pt-8 pb-32 mx-auto text-[var(--foreground)]"
      style={{ maxWidth: 720 }}
    >
      {/* ── Hero ── */}
      <div className="mb-4">
        <h1 className="text-[28px] font-black tracking-tight leading-none text-[var(--foreground)]">
          Menu
        </h1>
      </div>

      <SectionTitle>Your activity</SectionTitle>
      <SectionCard>
        <MenuRow icon={BarChart3} label="Progress" href="/progress" accent="#a8e845" />
        <MenuRow icon={BookOpen} label="Library" href="/explore" accent="#7dd3fc" />
        <MenuRow icon={Bookmark} label="Saved" href="/favorites" accent="#7dd3fc" />
      </SectionCard>

      <SectionTitle>Create</SectionTitle>
      <SectionCard>
        <MenuRow icon={Sparkles} label="Create story" href="/create" accent="#a892ff" />
        {showStoryOfWeek ? (
          <MenuRow
            icon={Star}
            label="Story of the Week"
            href="/story-of-the-week"
            accent="#f8c15c"
          />
        ) : null}
        {showStoryOfDay ? (
          <MenuRow
            icon={Star}
            label="Story of the Day"
            href="/story-of-the-day"
            accent="#f8c15c"
          />
        ) : null}
      </SectionCard>

      <SectionTitle>Account</SectionTitle>
      <SectionCard>
        {showUpgrade ? (
          <MenuRow icon={Zap} label="Upgrade" href="/plans" accent="#f8c15c" />
        ) : null}
        <MenuRow icon={SettingsIcon} label="Settings" href="/settings" accent="#9cb0c9" />
        {showTestMode ? (
          <MenuRow
            icon={RefreshCw}
            label="Test mode"
            onClick={handleTestModeReset}
            accent="#9cb0c9"
            trailing={
              testModeRunning ? (
                <Loader2
                  size={18}
                  className="animate-spin text-[var(--muted)] shrink-0"
                />
              ) : undefined
            }
          />
        ) : null}
        <SignOutButton>
          <MenuRow icon={LogOut} label="Sign out" accent="#ef4444" />
        </SignOutButton>
      </SectionCard>

      {/* Legal footer (paridad iPhone: Legal · Privacy · Terms). */}
      <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-[var(--muted)]">
        <Link href="/impressum" className="hover:underline">
          Legal
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>
      </div>
    </div>
  );
}
