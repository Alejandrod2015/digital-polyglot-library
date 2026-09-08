// De donde vino una cuenta.
//
// El origen ya se medía (`dp_page_visits_v1` guarda utm y referrer de cada
// visita), pero no había ningún puente entre la visita y la cuenta: la tabla
// de altas solo podía decir "beta" o "compró", y quien no era ninguna de las
// dos salía sin etiqueta y sin explicación. Este módulo es ese puente.
//
// Primer toque, no último: la cookie se escribe una sola vez y no se pisa, así
// que quien llega por un anuncio, se va y vuelve por Google dos días después
// sigue contando como anuncio. El último toque casi siempre es "directo" o
// "búsqueda de marca", que no dice de dónde salió nadie.

export const FIRST_TOUCH_COOKIE = "dp_first";
/** 90 días: la distancia normal entre el primer contacto y el alta. */
export const FIRST_TOUCH_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export type FirstTouch = {
  /** utm_source tal cual llegó, si venía. */
  s?: string;
  /** utm_campaign tal cual llegó, si venía. */
  c?: string;
  /** Host del referrer externo, sin el nuestro. */
  r?: string;
};

export type OriginKey =
  | "ad"
  | "email"
  | "shop"
  | "search"
  | "social"
  | "referral"
  | "direct"
  | "app-ios"
  | "app-android"
  | "unknown";

export type Origin = { key: OriginKey; label: string };

const SEARCH_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "search.brave.",
  "search.yahoo.",
  "ecosia.",
  "startpage.",
  "qwant.",
  "baidu.",
  "yandex.",
];
const SOCIAL_HOSTS = [
  "facebook.",
  "instagram.",
  "t.co",
  "twitter.",
  "x.com",
  "linkedin.",
  "reddit.",
  "youtube.",
  "tiktok.",
];
const AD_SOURCES = ["meta", "facebook", "instagram", "fb", "ig", "google-ads", "googleads"];

function host(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/^www\./, "").split("/")[0] || null;
  }
}

/** true para nuestros propios dominios: un salto interno no es un origen. */
export function isOwnHost(h: string | null): boolean {
  if (!h) return false;
  return (
    h.includes("digitalpolyglot") ||
    h.startsWith("localhost") ||
    h.startsWith("127.0.0.1")
  );
}

export function firstTouchFromVisit(input: {
  utmSource?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
}): FirstTouch {
  const touch: FirstTouch = {};
  const s = input.utmSource?.trim();
  const c = input.utmCampaign?.trim();
  const r = host(input.referrer);
  if (s) touch.s = s.slice(0, 60);
  if (c) touch.c = c.slice(0, 60);
  if (r && !isOwnHost(r)) touch.r = r.slice(0, 80);
  return touch;
}

/**
 * Etiqueta corta para la tabla. Un anuncio y un correo llevan su campaña
 * pegada porque es lo que distingue una tirada de otra; una búsqueda no lleva
 * el buscador porque da igual cuál fue.
 */
export function classifyOrigin(touch: FirstTouch | null | undefined): Origin {
  if (!touch) return { key: "unknown", label: "s/d" };
  const s = touch.s?.toLowerCase() ?? "";
  const r = touch.r ?? "";
  const campaign = touch.c ? ` · ${touch.c}` : "";

  if (s === "email") return { key: "email", label: `Correo${campaign}` };
  if (s === "shop") return { key: "shop", label: `Tienda${campaign}` };
  if (s && AD_SOURCES.includes(s)) return { key: "ad", label: `Anuncio${campaign}` };
  if (s) return { key: "referral", label: `${touch.s}${campaign}` };

  if (r) {
    if (SEARCH_HOSTS.some((h) => r.includes(h))) return { key: "search", label: "Búsqueda" };
    if (SOCIAL_HOSTS.some((h) => r.includes(h))) return { key: "social", label: `Redes · ${r.replace(/^www\./, "")}` };
    return { key: "referral", label: r.replace(/^www\./, "") };
  }
  return { key: "direct", label: "Directo" };
}

/** La app no trae utm: lo que sí sabemos es por qué tienda entró. */
export function appOrigin(platform: "ios" | "android"): Origin {
  return platform === "ios"
    ? { key: "app-ios", label: "App Store / TestFlight" }
    : { key: "app-android", label: "Google Play" };
}

const ORIGIN_KEYS: OriginKey[] = [
  "ad",
  "email",
  "shop",
  "search",
  "social",
  "referral",
  "direct",
  "app-ios",
  "app-android",
  "unknown",
];

/** Lo guardado en Clerk es una cadena "key|label", para no depender de la
 * versión del clasificador que corría el día del alta. */
export function encodeOrigin(o: Origin): string {
  return `${o.key}|${o.label}`.slice(0, 120);
}

export function decodeOrigin(raw: unknown): Origin | null {
  if (typeof raw !== "string" || !raw) return null;
  const [key, ...rest] = raw.split("|");
  const label = rest.join("|");
  if (!ORIGIN_KEYS.includes(key as OriginKey)) return null;
  return { key: key as OriginKey, label: label || key };
}

export function encodeFirstTouch(t: FirstTouch): string {
  return Buffer.from(JSON.stringify(t), "utf8").toString("base64url").slice(0, 400);
}

export function decodeFirstTouch(raw: string | null | undefined): FirstTouch | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const t: FirstTouch = {};
    if (typeof o.s === "string") t.s = o.s;
    if (typeof o.c === "string") t.c = o.c;
    if (typeof o.r === "string") t.r = o.r;
    return t;
  } catch {
    return null;
  }
}
