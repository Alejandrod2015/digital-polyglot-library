"use client";

// Escucha, en todo el documento, los clics que salen hacia la tienda y los
// manda a /api/log/outbound. Un unico listener delegado en la fase de captura,
// porque el cuerpo de un post se pinta con dangerouslySetInnerHTML y ahi no
// hay componente al que colgarle un onClick.
//
// No llama a preventDefault ni retrasa la navegacion: sendBeacon entrega el
// aviso aunque el navegador se lleve la pagina por delante en el mismo tick.

import { useEffect } from "react";

/** Los mismos hosts que valida el servidor. Aqui solo evita ruido de red. */
const TRACKED_HOSTS = new Set([
  "shop.digitalpolyglot.com",
  "digitalpolyglots.myshopify.com",
  "5c0086-a6.myshopify.com",
]);

function deviceCategoryFromUA(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}

function send(payload: Record<string, unknown>) {
  const url = "/api/log/outbound";
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
    }
  } catch {
    // cae al fetch
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "include",
  }).catch(() => {});
}

function isTracked(anchor: HTMLAnchorElement): boolean {
  try {
    return TRACKED_HOSTS.has(new URL(anchor.href, window.location.href).hostname);
  } catch {
    return false;
  }
}

export default function OutboundClickLogger() {
  useEffect(() => {
    // Un mismo enlace pulsado dos veces seguidas es un temblor de mano, no dos
    // intenciones. Sin esto, el ratio de clic saldria inflado.
    let lastHref = "";
    let lastAt = 0;

    function onClick(event: MouseEvent) {
      // El clic derecho abre un menu, no navega. El del medio (auxclick) si.
      if (event.type === "click" && event.button !== 0) return;
      if (event.type === "auxclick" && event.button !== 1) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor || !anchor.href || !isTracked(anchor)) return;

      const now = Date.now();
      if (anchor.href === lastHref && now - lastAt < 1500) return;
      lastHref = anchor.href;
      lastAt = now;

      // Que enlace de los de la pagina es, contando desde arriba. Los posts
      // repiten el mismo reclamo a mitad y al final, y esto es lo unico que
      // dira cual de las dos posiciones se pulsa.
      const all = Array.from(document.querySelectorAll("a[href]")).filter((a) =>
        isTracked(a as HTMLAnchorElement),
      );
      const linkIndex = all.indexOf(anchor);

      send({
        fromPath: window.location.pathname,
        href: anchor.href,
        linkIndex: linkIndex >= 0 ? linkIndex : undefined,
        label: (anchor.textContent || "").trim().slice(0, 200) || undefined,
        deviceCategory: deviceCategoryFromUA(navigator.userAgent),
      });
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  return null;
}
