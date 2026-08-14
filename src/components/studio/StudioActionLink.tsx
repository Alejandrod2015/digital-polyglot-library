"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type StudioActionLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  pendingLabel?: string;
};

export default function StudioActionLink({
  href,
  children,
  className,
  style,
  pendingLabel = "Abriendo...",
}: StudioActionLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  // Se renderiza como <a href> real (no <button>) para que el navegador dé
  // gratis "abrir en pestaña nueva": cmd/ctrl+click, click central y el menú
  // contextual. El click normal se sigue interceptando para navegar con el
  // router (transición cliente + spinner); los clicks con modificador se
  // dejan pasar al navegador.
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return; // deja que el navegador abra pestaña/ventana nueva
    }
    e.preventDefault();
    if (isPending) return;
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <a
      href={href}
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      onClick={handleClick}
      aria-busy={isPending || undefined}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        color: "inherit",
        cursor: isPending ? "progress" : "pointer",
        opacity: isPending ? 0.7 : 1,
        transition: "opacity 0.15s",
        ...(style ?? {}),
      }}
    >
      {isPending ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              display: "inline-block",
              animation: "spin 0.6s linear infinite",
            }}
          />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </a>
  );
}
