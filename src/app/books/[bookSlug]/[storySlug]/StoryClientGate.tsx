'use client';

import { ReactNode, useEffect, useState } from 'react';

type Props = {
  plan: 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';
  storyId: string;
  children: ReactNode;
  fallback: ReactNode;
  forceAllow?: boolean;
};

/**
 * StoryClientGate — versión visual con fade:
 * - Si `forceAllow` es true → muestra TODO el contenido sin bloqueo.
 * - Si no → muestra el contenido completo dentro de un contenedor recortado con fade + fallback.
 */
export default function StoryClientGate({
  plan, // eslint-disable-line @typescript-eslint/no-unused-vars
  storyId, // eslint-disable-line @typescript-eslint/no-unused-vars
  children,
  fallback,
  forceAllow = false,
}: Props) {

  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    let timeoutId: number | undefined;

    const onLockedPlay = () => {
      if (forceAllow) return;
      setHighlight(true);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        setHighlight(false);
      }, 600);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("audio-locked-play", onLockedPlay);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("audio-locked-play", onLockedPlay);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [forceAllow]);


  // Si el usuario tiene acceso completo, no hacemos nada especial.
  if (forceAllow) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Contenido completo, pero recortado visualmente con max-height + overflow-hidden */}
      <div className="relative max-h-[40vh] overflow-hidden">
        {children}

        {/* Fade overlay adaptado al tema para evitar contraste raro en claro */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-56 z-10"
          style={{
            background:
              "linear-gradient(to top, var(--bg-content) 26%, color-mix(in srgb, var(--bg-content) 78%, transparent) 62%, transparent 100%)",
          }}
        />
      </div>

      {/* Fallback (botón Upgrade, mensaje, etc.) debajo del área recortada */}
      <div
        className={`relative z-20 -mt-10 ${
          highlight ? "animate-pulse motion-safe:animate-pulse" : ""
        }`}
      >
        {fallback}
      </div>
    </div>
  );
}
