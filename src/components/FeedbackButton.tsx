'use client';

import { MessageSquare } from "lucide-react";

const FEEDBACK_MAILTO = `mailto:support@digitalpolyglot.com?subject=${encodeURIComponent(
  "Feedback; Digital Polyglot Library"
)}&body=${encodeURIComponent("Tell us what's on your mind:\n\n")}`;

export default function FeedbackButton() {
  // Botón flotante de feedback (esquina inferior derecha, desktop
  // only). Antes usaba `bg-[#1f1f1f]` hex hardcoded → en light mode
  // queda como un círculo negro fuerte sobre el cream. Ahora con
  // tokens semánticos: card-bg + border sutil + icono muted, hover
  // sube a foreground. Sigue siendo visible pero no compite con el
  // contenido.
  return (
    <a
      href={FEEDBACK_MAILTO}
      aria-label="Send feedback"
      title="Send feedback"
      className="hidden md:flex fixed bottom-4 right-4 z-50 items-center justify-center w-11 h-11 rounded-full border transition-colors hover:scale-[1.04]"
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--card-border)",
        color: "var(--muted)",
        boxShadow: "0 6px 18px -8px rgba(0,0,0,0.18)",
      }}
    >
      <MessageSquare size={18} strokeWidth={2} />
    </a>
  );
}
