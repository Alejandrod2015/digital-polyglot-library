"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Flame, Loader2, Plus, Settings, Zap } from "lucide-react";
import { formatVariantLabel } from "@/lib/languageVariant";
import { getLanguageFlag, isVariantValidForLanguage } from "@/lib/languageFlags";

type LanguageRow = {
  name: string;
  variant: string | null;
  variantLabel: string | null;
  flag: string;
  level: string | null;
  active: boolean;
  // Per-language stats. Default to 0 if not present in publicMetadata.
  streak: number;
  xpTotal: number;
  progress: number; // 0–100
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function cefrLabelFromPreferredLevel(preferredLevel: string | null | undefined): string | null {
  if (!preferredLevel) return null;
  const key = preferredLevel.trim().toLowerCase();
  if (key === "beginner") return "A1";
  if (key === "intermediate") return "B1";
  if (key === "advanced") return "C1";
  return null;
}

/**
 * Reads `publicMetadata.targetLanguagesStats: { name, streak, xpTotal, progress }[]`
 * and returns a Map keyed by language name. Falls back to zeros when absent.
 *
 * Server-side, the shape lives in Clerk publicMetadata and is written by the
 * preferences endpoint (`src/app/api/user/preferences/route.ts`) every time a
 * lesson finishes. See INTEGRATION_NOTES.md.
 */
function readStatsByName(metadata: Record<string, unknown>) {
  const raw = Array.isArray(metadata.targetLanguagesStats)
    ? (metadata.targetLanguagesStats as Array<Record<string, unknown>>)
    : [];
  const map = new Map<string, { streak: number; xpTotal: number; progress: number }>();
  for (const s of raw) {
    if (typeof s?.name !== "string") continue;
    map.set(s.name, {
      streak: typeof s.streak === "number" ? s.streak : 0,
      xpTotal: typeof s.xpTotal === "number" ? s.xpTotal : 0,
      progress: typeof s.progress === "number"
        ? Math.max(0, Math.min(100, s.progress))
        : 0,
    });
  }
  return map;
}

// MOCK DATA — remove this whole block when PR 2 lands and
// publicMetadata.targetLanguagesStats is populated server-side.
// Reviewers: grep for "MOCK DATA" to find and delete in one diff.
const MOCK_STATS: Record<string, { streak: number; xpTotal: number; progress: number }> = {
  German:    { streak: 7,  xpTotal: 1240, progress: 42 },
  Spanish:   { streak: 21, xpTotal: 8450, progress: 78 },
  French:    { streak: 0,  xpTotal: 120,  progress: 8  },
  Japanese:  { streak: 3,  xpTotal: 560,  progress: 18 },
  Italian:   { streak: 0,  xpTotal: 0,    progress: 0  },
  Portuguese:{ streak: 0,  xpTotal: 0,    progress: 0  },
};

export default function LanguageSwitcher({ open, onClose }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const sheetRef = useRef<HTMLDivElement>(null);

  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const dragControls = useRef({ startY: 0 }).current;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!switchingTo) onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, switchingTo]);

  if (!user) return null;
  const clerkUser = user;

  const metadata = (clerkUser.publicMetadata ?? {}) as Record<string, unknown>;
  const rawTargetLanguages = Array.isArray(metadata.targetLanguages)
    ? (metadata.targetLanguages.filter((v): v is string => typeof v === "string"))
    : [];
  const preferredVariant =
    typeof metadata.preferredVariant === "string" ? metadata.preferredVariant : null;
  const preferredLevel =
    typeof metadata.preferredLevel === "string" ? metadata.preferredLevel : null;

  const seen = new Set<string>();
  const targetLanguages = rawTargetLanguages.filter((name) => {
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  const statsByName = readStatsByName(metadata);
  // MOCK DATA — fallback so PR 1 looks identical to mockup-reference.html
  // even before publicMetadata.targetLanguagesStats is populated. Remove
  // this `if` block when PR 2 lands.
  if (statsByName.size === 0) {
    for (const [name, s] of Object.entries(MOCK_STATS)) statsByName.set(name, s);
  }

  const rows: LanguageRow[] = targetLanguages.map((name, index) => {
    const isActive = index === 0;
    const variant = isActive ? preferredVariant : null;
    const stats = statsByName.get(name) ?? { streak: 0, xpTotal: 0, progress: 0 };
    return {
      name,
      variant,
      variantLabel: formatVariantLabel(variant),
      flag: getLanguageFlag(name, variant),
      // NOTE: preferredLevel is global today. Showing it on every row is a
      // visual approximation. When per-language CEFR exists, swap to per-row.
      level: cefrLabelFromPreferredLevel(preferredLevel),
      active: isActive,
      ...stats,
    };
  });

  async function switchLanguage(targetName: string) {
    if (switchingTo) return;
    if (targetLanguages[0] === targetName) {
      onClose();
      return;
    }
    setSwitchingTo(targetName);
    try {
      const nextOrder = [targetName, ...targetLanguages.filter((name) => name !== targetName)];
      const nextVariant = isVariantValidForLanguage(preferredVariant, targetName)
        ? preferredVariant
        : null;

      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguages: nextOrder,
          preferredVariant: nextVariant,
        }),
      });
      if (!response.ok) {
        throw new Error(`preferences update failed: ${response.status}`);
      }
      await clerkUser.reload();
      onClose();
      router.push("/journey");
      router.refresh();
    } catch (err) {
      console.error("[language-switcher] switch failed", err);
      setSwitchingTo(null);
    }
  }

  // "See all" → settings, scrolled to the languages section.
  function goToSeeAll() {
    onClose();
    router.push("/settings#languages");
  }

  // "Add language" → settings, languages section, with the add flow open.
  function goToAddLanguage() {
    onClose();
    router.push("/settings#languages?add=1");
  }

  // Geometry for the progress ring around each flag.
  const RING_SIZE = 46;
  const RING_R = 20.5;
  const RING_C = 2 * Math.PI * RING_R;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Switch language"
          className="md:hidden fixed inset-0 z-[60]"
        >
          <motion.button
            type="button"
            aria-label="Close language switcher"
            onClick={() => {
              if (!switchingTo) onClose();
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
              if (switchingTo) return;
              if (info.offset.y > 80 || info.velocity.y > 600) {
                onClose();
              }
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] border border-b-0 border-[var(--card-border)] shadow-[0_-20px_50px_rgba(0,0,0,0.6)] text-white flex flex-col"
            style={{
              background: "linear-gradient(180deg, #0a2b56 0%, #051834 100%)",
              maxHeight: "85vh",
              paddingBottom: "max(22px, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-[5px] w-11 rounded-full bg-white/25" />
            </div>

            <div className="px-[22px] pt-3 pb-1">
              <div className="text-[10.5px] font-black tracking-[0.22em] text-white/60 uppercase">
                Switch language
              </div>
              <div className="mt-1 text-[22px] font-black leading-tight tracking-[-0.02em] text-white">
                {targetLanguages.length === 1
                  ? "Your journey"
                  : `${targetLanguages.length} journeys in progress`}
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto px-4 pt-3 flex flex-col gap-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {rows.map((row) => {
                const isSwitching = switchingTo === row.name;
                const disabled = Boolean(switchingTo) && !isSwitching;
                const ringDash = (row.progress / 100) * RING_C;
                return (
                  <button
                    type="button"
                    key={row.name}
                    onClick={() => switchLanguage(row.name)}
                    disabled={disabled || isSwitching}
                    className={[
                      "flex items-center gap-3 p-3 rounded-[18px] text-left transition-colors",
                      row.active
                        ? "border-[1.5px] border-lime-300/40"
                        : "border border-[var(--card-border)] bg-white/[0.035] hover:bg-white/[0.06]",
                      disabled ? "opacity-40" : "",
                    ].join(" ")}
                    style={
                      row.active
                        ? {
                            background:
                              "linear-gradient(135deg, rgba(190,242,100,0.12), rgba(125,211,252,0.06))",
                          }
                        : undefined
                    }
                  >
                    {/* Flag with progress ring */}
                    <div
                      className="relative flex-shrink-0"
                      style={{ width: RING_SIZE, height: RING_SIZE }}
                    >
                      <svg
                        width={RING_SIZE}
                        height={RING_SIZE}
                        className="absolute inset-0"
                        style={{ transform: "rotate(-90deg)" }}
                        aria-hidden
                      >
                        <circle
                          cx={RING_SIZE / 2}
                          cy={RING_SIZE / 2}
                          r={RING_R}
                          fill="none"
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth={2.5}
                        />
                        <circle
                          cx={RING_SIZE / 2}
                          cy={RING_SIZE / 2}
                          r={RING_R}
                          fill="none"
                          stroke={row.active ? "#bef264" : "#7dd3fc"}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeDasharray={`${ringDash} ${RING_C}`}
                        />
                      </svg>
                      <div
                        aria-hidden
                        className="absolute inset-[5px] flex items-center justify-center text-[26px] leading-none"
                      >
                        {row.flag}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                        <span className="text-[15.5px] font-black tracking-[-0.015em] text-white truncate">
                          {row.name}
                        </span>
                        {row.variantLabel ? (
                          <span className="text-[10px] font-bold text-white/55 whitespace-nowrap">
                            · {row.variantLabel}
                          </span>
                        ) : null}
                      </div>

                      {/* Stats row: streak · xp · CEFR */}
                      <div className="mt-1 flex items-center gap-2.5">
                        <span
                          className="inline-flex items-center gap-[3px] text-[12px] font-black tracking-[-0.02em]"
                          style={{
                            color: row.streak > 0 ? "#fb923c" : "rgba(255,255,255,0.45)",
                          }}
                        >
                          <Flame size={11} />
                          {row.streak}
                        </span>
                        <span
                          className="inline-flex items-center gap-[3px] text-[12px] font-black tracking-[-0.02em]"
                          style={{ color: "#bef264" }}
                        >
                          <Zap size={11} />
                          {row.xpTotal >= 1000
                            ? `${(row.xpTotal / 1000).toFixed(1)}k`
                            : row.xpTotal}
                        </span>
                        {row.level ? (
                          <span className="inline-block rounded-md px-[7px] py-[2px] text-[9.5px] font-black tracking-wider text-sky-300 bg-sky-300/10">
                            {row.level}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isSwitching ? (
                      <Loader2 size={16} className="text-white/70 animate-spin flex-shrink-0" />
                    ) : row.active ? (
                      <span className="flex-shrink-0 rounded-full bg-lime-300 px-2.5 py-1 text-[9.5px] font-black tracking-[0.14em] text-[#0a2b56]">
                        ACTIVE
                      </span>
                    ) : (
                      <ChevronRight size={16} className="text-white/45 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-white/10 px-4 pt-3 flex gap-2">
              <button
                type="button"
                onClick={goToSeeAll}
                disabled={Boolean(switchingTo)}
                className="flex-1 rounded-[14px] border border-white/10 bg-white/[0.04] py-3 text-[12.5px] font-bold text-white/80 hover:bg-white/[0.07] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <Settings size={13} />
                See all
              </button>
              <button
                type="button"
                onClick={goToAddLanguage}
                disabled={Boolean(switchingTo)}
                className="flex-1 rounded-[14px] border border-sky-300/30 bg-sky-300/10 py-3 text-[12.5px] font-bold text-sky-300 hover:bg-sky-300/15 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <Plus size={13} />
                Add language
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
