"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderPlus, Trash2 } from "lucide-react";

type Props = {
  /** Stable identity for this row. Used by the parent to enforce
   *  "only one row swiped open at a time". */
  swipeKey: string;
  /** The key of whichever row is currently in the open slot, if any.
   *  When this changes to a different key (or null), this row springs
   *  back to closed. */
  openSwipeKey: string | null;
  onSwipeOpenChange: (key: string | null) => void;
  /** Called AFTER the exit animation finishes (~280 ms). Use this to
   *  remove the underlying record from your list so the row collapsing
   *  out of view feels natural. */
  onDeleteConfirmed: () => void;
  /** Word/label shown in the confirm dialog. */
  confirmLabel?: string;
  /** Optional second action; "Add to collection". When provided, the
   *  swipe reveals BOTH Collection + Delete (panel width doubles). */
  onAddToCollection?: () => void;
  children: React.ReactNode;
};

/**
 * iPhone-parity swipe-to-delete row, web edition.
 *
 * Drag the row left to reveal the red "Delete" action panel (84 px).
 * Releasing past the half-way point snaps open; otherwise it springs
 * back. Tapping Delete prompts a window.confirm and, on yes, runs the
 * full exit animation (slide left + fade + height collapse) and finally
 * calls onDeleteConfirmed.
 *
 * Single-open coordination: the parent owns the open-row key. Whenever
 * a new row opens, we publish our key; whenever the parent's
 * `openSwipeKey` becomes something else, we spring closed.
 *
 * Mobile reference: `SwipeableFavoriteCard` in MobileLibraryShell.tsx.
 */
export default function SwipeableRow({
  swipeKey,
  openSwipeKey,
  onSwipeOpenChange,
  onDeleteConfirmed,
  confirmLabel,
  onAddToCollection,
  children,
}: Props) {
  const SINGLE_ACTION_WIDTH = 84;
  const ACTION_WIDTH = onAddToCollection ? SINGLE_ACTION_WIDTH * 2 : SINGLE_ACTION_WIDTH;

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);

  const dragStartXRef = useRef<number | null>(null);
  const dragStartOffsetRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-close when another row claims the open slot.
  useEffect(() => {
    if (openSwipeKey !== swipeKey && offset !== 0 && !dragging) {
      setOffset(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSwipeKey]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Ignore right/middle clicks and non-primary touches.
    if (e.button !== undefined && e.button !== 0) return;
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = offset;
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }, [offset]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartXRef.current === null) return;
    const dx = e.clientX - dragStartXRef.current;
    const next = dragStartOffsetRef.current + dx;
    // Clamp: only swipe left (negative); never overshoot the action width.
    const clamped = Math.min(0, Math.max(-ACTION_WIDTH, next));
    setOffset(clamped);
  }, []);

  const onPointerEnd = useCallback((e: React.PointerEvent) => {
    if (dragStartXRef.current === null) return;
    const dx = e.clientX - dragStartXRef.current;
    dragStartXRef.current = null;
    setDragging(false);
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);

    // Snap: from-closed → open if user dragged > 2px left.
    // From-open → closed if user dragged > 2px right.
    const wasOpen = dragStartOffsetRef.current === -ACTION_WIDTH;
    let target: number;
    if (!wasOpen && dx < -2) target = -ACTION_WIDTH;
    else if (wasOpen && dx > 2) target = 0;
    else target = dragStartOffsetRef.current;

    setOffset(target);
    onSwipeOpenChange(target === -ACTION_WIDTH ? swipeKey : null);
  }, [onSwipeOpenChange, swipeKey]);

  function handleDeletePress() {
    const ok = window.confirm(
      `Remove ${confirmLabel ? `"${confirmLabel}"` : "this item"} from your favorites?`,
    );
    if (!ok) {
      setOffset(0);
      onSwipeOpenChange(null);
      return;
    }
    setExiting(true);
    // Match the mobile timing: ~280 ms for the full exit feel.
    setTimeout(() => {
      onDeleteConfirmed();
    }, 280);
  }

  const transform = exiting
    ? "translateX(-110%) scaleY(0)"
    : `translateX(${offset}px)`;
  const transition = dragging
    ? "none"
    : exiting
      ? "transform 260ms ease-out, opacity 220ms ease-out"
      : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        opacity: exiting ? 0 : 1,
        // Collapse the row's vertical space when exiting so the list
        // tightens up after delete instead of leaving a gap.
        maxHeight: exiting ? 0 : undefined,
        transition: exiting
          ? "max-height 260ms ease-out, opacity 220ms ease-out"
          : undefined,
      }}
    >
      {/* Action panel behind the row */}
      <div
        aria-hidden={offset === 0}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: ACTION_WIDTH,
          display: "flex",
        }}
      >
        {onAddToCollection ? (
          <button
            type="button"
            onClick={() => {
              // Close the panel before firing the modal so the row
              // visually settles back while the dialog comes up.
              setOffset(0);
              onSwipeOpenChange(null);
              onAddToCollection();
            }}
            aria-label="Add to collection"
            style={{ width: SINGLE_ACTION_WIDTH }}
            className="flex h-full flex-col items-center justify-center gap-1 border-l border-sky-400/30 bg-[#0e2a44] text-sky-300 transition hover:bg-[#163457]"
          >
            <FolderPlus className="h-4 w-4" />
            <span className="text-[11px] font-bold">Collection</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleDeletePress}
          aria-label="Delete favorite"
          style={{ width: SINGLE_ACTION_WIDTH }}
          className="flex h-full flex-col items-center justify-center gap-1 border-l border-rose-500/30 bg-[#2a1416] text-rose-300 transition hover:bg-[#3a1a1d]"
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[11px] font-bold">Delete</span>
        </button>
      </div>

      {/* Sliding card. Touch-action: pan-y lets vertical scroll pass
          through to the parent list; horizontal pan is captured here. */}
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          transform,
          transition,
          touchAction: "pan-y",
          // Card itself stays opaque so the panel underneath only shows
          // when the user has actually swiped.
          position: "relative",
          zIndex: 1,
          background: "var(--bg-content)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
