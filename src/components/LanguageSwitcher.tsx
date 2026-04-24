"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Loader2, Plus, Settings } from "lucide-react";
import { formatVariantLabel } from "@/lib/languageVariant";
import { getLanguageFlag, isVariantValidForLanguage } from "@/lib/languageFlags";

type LanguageRow = {
  name: string;
  variant: string | null;
  variantLabel: string | null;
  flag: string;
  level: string | null;
  active: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Maps the user's onboarding-level preference ("Beginner" / "Intermediate" /
 * "Advanced") to a CEFR-style pill value. This is global in the current
 * schema, so it's only accurate for the active language — inactive rows
 * render without a CEFR pill by design.
 */
function cefrLabelFromPreferredLevel(preferredLevel: string | null | undefined): string | null {
  if (!preferredLevel) return null;
  const key = preferredLevel.trim().toLowerCase();
  if (key === "beginner") return "A1";
  if (key === "intermediate") return "B1";
  if (key === "advanced") return "C1";
  return null;
}

export default function LanguageSwitcher({ open, onClose }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Loading state scoped to "switch in flight" so the sheet can disable all
  // rows (preventing rapid-tap race conditions) and show a spinner only on
  // the pending row.
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  // Drag-to-dismiss: we only close when the user drags down far enough.
  const dragControls = useRef({ startY: 0 }).current;

  /* Scroll lock + Escape handler. Mirrors StudioConfirmDialog's pattern. */
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
  // Capture the narrowed user into a local const so closures inside
  // callbacks keep the non-null type without re-checking.
  const clerkUser = user;

  const metadata = (clerkUser.publicMetadata ?? {}) as Record<string, unknown>;
  const rawTargetLanguages = Array.isArray(metadata.targetLanguages)
    ? (metadata.targetLanguages.filter((v): v is string => typeof v === "string"))
    : [];
  const preferredVariant =
    typeof metadata.preferredVariant === "string" ? metadata.preferredVariant : null;
  const preferredLevel =
    typeof metadata.preferredLevel === "string" ? metadata.preferredLevel : null;

  // Dedupe while preserving order. The first entry is the active language
  // (convention used across HomeClient / ExploreClient / JourneyClient).
  const seen = new Set<string>();
  const targetLanguages = rawTargetLanguages.filter((name) => {
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  const rows: LanguageRow[] = targetLanguages.map((name, index) => {
    const isActive = index === 0;
    // Variant only applies to the active language in the current schema —
    // inactive rows show the language alone.
    const variant = isActive ? preferredVariant : null;
    return {
      name,
      variant,
      variantLabel: formatVariantLabel(variant),
      flag: getLanguageFlag(name, variant),
      level: isActive ? cefrLabelFromPreferredLevel(preferredLevel) : null,
      active: isActive,
    };
  });

  async function switchLanguage(targetName: string) {
    if (switchingTo) return;
    // Already active → no-op, just close.
    if (targetLanguages[0] === targetName) {
      onClose();
      return;
    }
    setSwitchingTo(targetName);
    try {
      const nextOrder = [targetName, ...targetLanguages.filter((name) => name !== targetName)];
      // If the current preferredVariant doesn't belong to the new active
      // language, clear it in the same request so the new Journey doesn't
      // inherit an invalid variant (e.g. "spain" on German).
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
      // Drop `?variant=` from the Journey URL so the server re-picks the
      // variant for the new active language on the next navigation.
      router.push("/journey");
      router.refresh();
    } catch (err) {
      console.error("[language-switcher] switch failed", err);
      setSwitchingTo(null);
    }
  }

  function goToAddLanguage() {
    onClose();
    router.push("/settings");
  }

  function goToSeeAll() {
    onClose();
    router.push("/settings");
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Switch language"
          className="md:hidden fixed inset-0 z-[60]"
        >
          {/* Backdrop — tap to dismiss, disabled during an in-flight switch. */}
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

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onPointerDown={(event) => {
              dragControls.startY = event.clientY;
            }}
            onDragEnd={(_, info) => {
              // Close if the user dragged down more than 80px OR flung it
              // downward quickly. Otherwise snap back.
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
            {/* Grabber */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-[5px] w-11 rounded-full bg-white/25" />
            </div>

            {/* Header */}
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

            {/* Rows */}
            <div
              className="flex-1 overflow-y-auto px-4 pt-3 flex flex-col gap-2"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {rows.map((row) => {
                const isSwitching = switchingTo === row.name;
                const disabled = Boolean(switchingTo) && !isSwitching;
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
                    <span
                      aria-hidden
                      className="flex-shrink-0 inline-flex items-center justify-center text-[30px] leading-none"
                      style={{ width: 46, height: 46 }}
                    >
                      {row.flag}
                    </span>

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

                      {row.level ? (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-block rounded-md px-[7px] py-[2px] text-[9.5px] font-black tracking-wider text-sky-300 bg-sky-300/10">
                            {row.level}
                          </span>
                        </div>
                      ) : null}
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

            {/* Footer */}
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
