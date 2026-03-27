"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function StudioConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  /* Auto-focus cancel button when dialog opens */
  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [open]);

  /* Escape key to close, focus trapping */
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      /* Simple focus trap between the two buttons */
      if (e.key === "Tab") {
        const dialog = document.getElementById("studio-confirm-dialog");
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>("button");
        if (focusable.length < 2) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmColor = danger ? "#ef4444" : "var(--primary)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-confirm-title"
      aria-describedby="studio-confirm-desc"
    >
      <div
        id="studio-confirm-dialog"
        className="studio-toast"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          maxWidth: "90vw",
          borderRadius: 12,
          backgroundColor: "var(--surface)",
          border: "1px solid var(--card-border)",
          padding: 24,
          boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        }}
      >
        <h3 id="studio-confirm-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
          {title}
        </h3>
        <p id="studio-confirm-desc" style={{ fontSize: 14, color: "var(--muted)", margin: "8px 0 20px", lineHeight: 1.5 }}>
          {description}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="studio-btn-ghost"
            aria-label={cancelLabel}
            style={{
              height: 36, borderRadius: 8, border: "1px solid var(--card-border)",
              backgroundColor: "transparent", color: "var(--foreground)",
              padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="studio-btn-primary"
            aria-label={confirmLabel}
            style={{
              height: 36, borderRadius: 8, border: "none",
              backgroundColor: confirmColor, color: "#fff",
              padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
