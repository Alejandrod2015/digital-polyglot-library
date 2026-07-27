"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { formatVariantLabel } from "@/lib/languageVariant";
import { getLanguageCountry } from "@/lib/languageFlags";
import Flag from "@/components/Flag";

// One published journey, as returned by /api/journeys/catalog. Same set the
// Home/Journey switcher shows, so Favorites/Practice stay consistent with it
// instead of the old targetLanguages+mock-stats list (which showed "0
// journeys in progress" whenever the user had no explicit language preference).
type CatalogOption = {
  slug: string;
  label: string;
  language: string | null;
  variant: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const LANG_SHORT: Record<string, string> = {
  spanish: "ES", english: "EN", french: "FR", german: "DE",
  italian: "IT", portuguese: "PT", japanese: "JA", korean: "KO",
  chinese: "ZH",
};

function langShortFor(language: string | null): string {
  if (!language) return "??";
  const key = language.trim().toLowerCase();
  return LANG_SHORT[key] ?? language.slice(0, 2).toUpperCase();
}

export default function LanguageSwitcher({ open, onClose }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const sheetRef = useRef<HTMLDivElement>(null);

  const [switchingSlug, setSwitchingSlug] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogOption[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const dragControls = useRef({ startY: 0 }).current;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!switchingSlug) onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, switchingSlug]);

  // Lazy-load the real journey catalog the first time the sheet opens.
  useEffect(() => {
    if (!open || catalog !== null || catalogLoading) return;
    setCatalogLoading(true);
    fetch("/api/journeys/catalog")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { options?: CatalogOption[] }) => {
        setCatalog(Array.isArray(data.options) ? data.options : []);
      })
      .catch((err) => {
        console.error("[language-switcher] catalog fetch failed", err);
        setCatalog([]);
      })
      .finally(() => setCatalogLoading(false));
  }, [open, catalog, catalogLoading]);

  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const preferredVariant =
    typeof metadata.preferredVariant === "string" ? metadata.preferredVariant : null;
  const rawTargetLanguages = Array.isArray(metadata.targetLanguages)
    ? metadata.targetLanguages.filter((v): v is string => typeof v === "string")
    : [];
  const activeLanguage = rawTargetLanguages[0] ?? null;

  // The active journey: match preferredVariant first (exact journey), else the
  // first journey of the active language, so a row is highlighted even when
  // only the language is known.
  const activeSlug = useMemo(() => {
    if (!catalog) return null;
    const byVariant = preferredVariant
      ? catalog.find((c) => (c.variant ?? "").toLowerCase() === preferredVariant.toLowerCase())
      : null;
    if (byVariant) return byVariant.slug;
    if (activeLanguage) {
      const byLang = catalog.find(
        (c) => (c.language ?? "").toLowerCase() === activeLanguage.toLowerCase()
      );
      if (byLang) return byLang.slug;
    }
    return null;
  }, [catalog, preferredVariant, activeLanguage]);

  async function switchToJourney(option: CatalogOption) {
    if (switchingSlug) return;
    if (option.slug === activeSlug) {
      onClose();
      return;
    }
    setSwitchingSlug(option.slug);
    try {
      const nextLanguages = option.language
        ? [option.language, ...rawTargetLanguages.filter((n) => n !== option.language)]
        : rawTargetLanguages;
      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguages: nextLanguages,
          preferredVariant: option.variant ?? null,
        }),
      });
      if (!response.ok) throw new Error(`preferences update failed: ${response.status}`);
      // Reload Clerk user so the parent page re-derives its active language
      // from metadata and re-scopes its content (favorites/practice) in place.
      await user?.reload();
      onClose();
      router.refresh();
    } catch (err) {
      console.error("[language-switcher] switch failed", err);
    } finally {
      setSwitchingSlug(null);
    }
  }

  // "Add journey" → the canonical add flow lives on the Journey surface
  // (inline language → journey picker). Never Settings.
  function goToAddJourney() {
    onClose();
    router.push("/journey");
  }

  if (!user) return null;

  const journeyCount = catalog?.length ?? 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Switch journey"
          className="fixed inset-0 z-[60]"
        >
          <motion.button
            type="button"
            aria-label="Close journey switcher"
            onClick={() => {
              if (!switchingSlug) onClose();
            }}
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />

          <motion.div
            ref={sheetRef}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onPointerDown={(event) => {
              dragControls.startY = event.clientY;
            }}
            onDragEnd={(_, info) => {
              if (switchingSlug) return;
              if (info.offset.y > 80 || info.velocity.y > 600) {
                onClose();
              }
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] border border-b-0 border-[var(--card-border)] shadow-[0_-20px_50px_rgba(0,0,0,0.6)] flex flex-col"
            style={{
              background:
                "linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1, var(--background)) 100%)",
              color: "var(--foreground)",
              maxHeight: "85vh",
              paddingBottom: "max(22px, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div
                className="h-[5px] w-11 rounded-full"
                style={{ background: "var(--card-border)" }}
              />
            </div>

            <div className="px-[22px] pt-3 pb-1">
              <div className="text-[10.5px] font-black tracking-[0.22em] uppercase text-[var(--muted)]">
                Switch journey
              </div>
              <div className="mt-1 text-[26px] font-black leading-tight tracking-[-0.02em] text-[var(--foreground)]">
                {catalogLoading && catalog === null
                  ? "Loading journeys…"
                  : journeyCount === 1
                    ? "Your journey"
                    : `${journeyCount} journeys in progress`}
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto px-[22px] pt-4 flex flex-col gap-3"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {(catalog ?? []).map((option) => {
                const isSwitching = switchingSlug === option.slug;
                const disabled = Boolean(switchingSlug) && !isSwitching;
                const isActive = option.slug === activeSlug;
                const country = getLanguageCountry(option.language ?? "", option.variant);
                const variantLabel = formatVariantLabel(option.variant);
                return (
                  <button
                    type="button"
                    key={option.slug}
                    onClick={() => switchToJourney(option)}
                    disabled={disabled || isSwitching}
                    className={[
                      "flex items-center gap-3.5 p-3.5 rounded-[18px] text-left transition-colors",
                      isActive ? "border-[1.5px]" : "border",
                      disabled ? "opacity-40" : "",
                    ].join(" ")}
                    style={
                      isActive
                        ? {
                            background: "rgba(252, 211, 77, 0.08)",
                            borderColor: "rgba(252, 211, 77, 0.55)",
                          }
                        : {
                            background: "var(--card-bg)",
                            borderColor: "var(--card-border)",
                          }
                    }
                  >
                    <div
                      aria-hidden
                      className="shrink-0 grid place-items-center leading-none"
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: "var(--card-bg-hover)",
                        boxShadow:
                          "inset 0 0 0 1.5px rgba(125,211,252,0.45), inset 0 0 0 4px var(--bg-2), inset 0 0 0 5.5px rgba(125,211,252,0.25)",
                      }}
                    >
                      <Flag code={country} size={28} title={langShortFor(option.language)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                        <span className="text-[17px] font-black tracking-[-0.015em] truncate text-[var(--foreground)]">
                          {option.label}
                        </span>
                      </div>
                      <div className="mt-1 text-[13px] font-bold text-[var(--muted)]">
                        {langShortFor(option.language)}
                        {variantLabel ? ` · ${variantLabel}` : ""}
                      </div>
                    </div>

                    {isSwitching ? (
                      <Loader2 size={16} className="animate-spin shrink-0 text-[var(--muted)]" />
                    ) : isActive ? (
                      <span
                        className="shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black tracking-[0.14em]"
                        style={{
                          background: "var(--color-gold)",
                          color: "var(--color-gold-ink)",
                        }}
                      >
                        ACTIVE
                      </span>
                    ) : (
                      <ChevronRight size={18} className="shrink-0 text-[var(--muted)]" />
                    )}
                  </button>
                );
              })}
              {!catalogLoading && journeyCount === 0 ? (
                <div className="py-6 text-center text-sm text-[var(--muted)]">
                  No journeys available.
                </div>
              ) : null}
            </div>

            {/* "+ Add journey" → canonical add flow on the Journey surface. */}
            <div
              className="mt-3 px-[22px] pt-3"
              style={{ borderTop: "1px solid var(--card-border)" }}
            >
              <button
                type="button"
                onClick={goToAddJourney}
                disabled={Boolean(switchingSlug)}
                className="w-full rounded-[16px] border border-sky-300/30 bg-sky-300/[0.08] py-3.5 text-[15px] font-bold text-sky-300 hover:bg-sky-300/12 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Plus size={16} strokeWidth={2.6} />
                Add journey
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
