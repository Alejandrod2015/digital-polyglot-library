'use client';

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { MessageSquare } from "lucide-react";

/**
 * Botón flotante de feedback.
 *
 * Antes era un `mailto:` y nada más. Lo que la gente escribía llegaba a un
 * buzón y NUNCA a `BetaFeedback`, así que el contador de "open feedback" del
 * Studio no podía moverse por mucho que escribieran: el 0 que veías no medía
 * silencio, medía un cable suelto. Y con `hidden md:flex` ni siquiera aparecía
 * en móvil web, que es de donde viene la mayoría de las altas.
 *
 * Ahora escribe en la misma tabla que el móvil, vía POST autenticado por
 * sesión. El `mailto:` sigue existiendo como salida de emergencia para quien
 * no ha iniciado sesión o si el envío falla: perder el mensaje de alguien que
 * se molestó en escribirlo es peor que cualquier otra cosa que pueda pasar
 * aquí.
 */

const FEEDBACK_MAILTO = `mailto:support@digitalpolyglot.com?subject=${encodeURIComponent(
  "Feedback; Digital Polyglot Library"
)}&body=${encodeURIComponent("Tell us what's on your mind:\n\n")}`;

const KINDS = [
  { value: "bug", label: "Something broke" },
  { value: "confusing", label: "Confusing" },
  { value: "idea", label: "Idea" },
  { value: "praise", label: "I liked it" },
] as const;

export default function FeedbackButton() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("bug");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) areaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sin sesión no hay a quién atribuir el mensaje, así que ahí el correo sigue
  // siendo la vía honesta en lugar de un formulario que fallaría al enviar.
  if (!isLoaded || !isSignedIn) {
    return (
      <a
        href={FEEDBACK_MAILTO}
        aria-label="Send feedback"
        title="Send feedback"
        className="flex fixed bottom-4 right-4 z-50 items-center justify-center w-11 h-11 rounded-full border transition-colors hover:scale-[1.04]"
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

  async function send() {
    if (message.trim().length < 3) return;
    setState("sending");
    try {
      const res = await fetch("/api/beta/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message: message.trim(), screen: pathname || "web app" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("sent");
      setMessage("");
      window.setTimeout(() => {
        setOpen(false);
        setState("idle");
      }, 1600);
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        title="Send feedback"
        className="flex fixed bottom-4 right-4 z-50 items-center justify-center w-11 h-11 rounded-full border transition-colors hover:scale-[1.04]"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--card-border)",
          color: "var(--muted)",
          boxShadow: "0 6px 18px -8px rgba(0,0,0,0.18)",
        }}
      >
        <MessageSquare size={18} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Send feedback"
          className="fixed bottom-20 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border p-4"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--card-border)",
            boxShadow: "0 18px 44px -20px rgba(0,0,0,0.5)",
          }}
        >
          {state === "sent" ? (
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Got it. Thank you.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors"
                    style={{
                      borderColor: kind === k.value ? "var(--studio-accent)" : "var(--card-border)",
                      color: kind === k.value ? "var(--studio-accent)" : "var(--muted)",
                    }}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={areaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="One line is enough."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--card-border)",
                  color: "var(--foreground)",
                }}
              />
              <div className="flex items-center justify-between mt-3 gap-2">
                <a
                  href={FEEDBACK_MAILTO}
                  className="text-[11px] underline"
                  style={{ color: "var(--muted)" }}
                >
                  Email instead
                </a>
                <button
                  type="button"
                  onClick={send}
                  disabled={state === "sending" || message.trim().length < 3}
                  className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
                  style={{ background: "var(--studio-accent)", color: "#04121f" }}
                >
                  {state === "sending" ? "Sending…" : "Send"}
                </button>
              </div>
              {state === "error" && (
                <p className="text-[11px] mt-2" style={{ color: "#f87171" }}>
                  That did not go through. Use{" "}
                  <a href={FEEDBACK_MAILTO} className="underline">
                    email
                  </a>{" "}
                  so it is not lost.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
