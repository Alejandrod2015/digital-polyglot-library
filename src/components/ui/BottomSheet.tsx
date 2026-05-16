"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useEffect } from "react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
  dismissThreshold?: number;
  maxHeight?: string;
  ariaLabel?: string;
};

// Bottom sheet primitive. Extracted from the LanguageSwitcher
// modal pattern so other surfaces (vocab, sheets, exit prompts)
// get the same iOS-like feel: spring slide-up, drag-to-dismiss,
// safe-area-aware bottom padding, backdrop blur.
export default function BottomSheet({
  open,
  onClose,
  children,
  title,
  eyebrow,
  dismissThreshold = 80,
  maxHeight = "85vh",
  ariaLabel,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? title ?? "Bottom sheet"}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info: PanInfo) => {
              if (info.offset.y > dismissThreshold || info.velocity.y > 600) {
                onClose();
              }
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-xl rounded-t-[28px] border border-b-0 border-[var(--card-border)] shadow-[0_-20px_50px_rgba(0,0,0,0.6)] text-white flex flex-col"
            style={{
              background: "linear-gradient(180deg, #0a2b56 0%, #051834 100%)",
              maxHeight,
              paddingBottom: "max(22px, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-[5px] w-11 rounded-full bg-white/25" />
            </div>

            {eyebrow || title ? (
              <div className="px-[22px] pt-3 pb-2">
                {eyebrow ? (
                  <div className="text-[10.5px] font-black tracking-[0.22em] text-white/60 uppercase">
                    {eyebrow}
                  </div>
                ) : null}
                {title ? (
                  <div className="mt-1 text-[22px] font-black leading-tight tracking-[-0.02em] text-white">
                    {title}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              className="flex-1 overflow-y-auto px-[22px] pt-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
