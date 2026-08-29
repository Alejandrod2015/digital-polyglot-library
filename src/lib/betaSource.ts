// De dónde salió cada beta tester.
//
// Nadie se lo pregunta: el formulario de /beta captura los utm, el referrer y
// la landing en `attribution` al montar, y esto los traduce a un origen con
// nombre. Es la única respuesta no sesgada a "qué está trayendo testers".
// El campo "How did you hear about us?" (`referralSource`) NO sirve para esto:
// no tiene opción de comprador de la tienda, así que jamás va a cuadrar con
// una campaña de la tienda.
//
// La clave manda sobre la etiqueta: `key` es estable y se puede agrupar, la
// etiqueta se puede reescribir sin romper un reporte viejo.

export type BetaSourceGroup =
  | "shop"
  | "email"
  | "social"
  | "search"
  | "web"
  | "direct"
  | "unmeasured"
  | "internal";

/** El trozo de `BetaSignup.attribution` que habla de origen. */
export type BetaAttributionLike = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  landingUrl?: string | null;
} | null;

export type BetaSource = {
  /** Estable, para agrupar y comparar entre reportes. */
  key: string;
  label: string;
  group: BetaSourceGroup;
  campaign: string | null;
  /** El freebie concreto, la lista de Brevo o el host que refirió. */
  detail: string | null;
  /** source/medium tal cual llegaron, para reconciliar con la tienda. */
  raw: string | null;
};

/**
 * Los tres puntos de contacto de la tienda (Shopify + dp-studio), por
 * `utm_medium`. Todos llegan con `utm_source=shop`.
 */
const SHOP_MEDIUMS: Record<string, string> = {
  freebie_delivery: "Tienda: email del freebie",
  freebie_success: "Tienda: pantalla tras el claim",
  order_confirmation: "Tienda: email de pedido",
};

/** Hosts que sabemos leer cuando no hay utm ninguno. */
const HOST_LABELS: Array<[RegExp, string, BetaSourceGroup]> = [
  [/(^|\.)instagram\.com$/, "Instagram", "social"],
  [/(^|\.)facebook\.com$/, "Facebook", "social"],
  [/(^|\.)tiktok\.com$/, "TikTok", "social"],
  [/(^|\.)(x|twitter)\.com$|^t\.co$/, "X", "social"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube", "social"],
  [/(^|\.)reddit\.com$/, "Reddit", "social"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn", "social"],
  [/(^|\.)google\./, "Google", "search"],
  [/(^|\.)bing\.com$/, "Bing", "search"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo", "search"],
  [/(^|\.)ecosia\.org$/, "Ecosia", "search"],
  [/sendibm\d*\.com$|(^|\.)brevo\.com$|(^|\.)sendinblue\.com$/, "Brevo", "email"],
  [/(^|\.)digitalpolyglot\.com$/, "La propia web", "internal"],
  [/(^|\.)myshopify\.com$/, "La tienda, sin campaña", "shop"],
];

/** Fuentes de email transaccional o de campaña, por `utm_source`. */
const EMAIL_SOURCES = new Set(["email", "brevo", "sendinblue", "newsletter", "mailchimp"]);

const SOCIAL_SOURCES = new Set(["instagram", "ig", "facebook", "fb", "tiktok", "twitter", "x", "youtube", "linkedin", "reddit"]);
const SEARCH_SOURCES = new Set(["google", "bing", "duckduckgo", "ecosia", "yandex"]);

function host(url: string): string | null {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function clean(v: string | null | undefined): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

function titleish(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]+/g, " ");
}

/**
 * Un alta a un origen. Nunca tira: un `utm_source` que todavía no existe sale
 * con su propio nombre en vez de caer en "otros", que es justo lo que hace
 * falta para ver aparecer una fuente nueva sin tocar código.
 */
export function classifyBetaSource(attr: BetaAttributionLike): BetaSource {
  if (!attr || Object.keys(attr).length === 0) {
    return {
      key: "unmeasured",
      label: "Sin medir",
      group: "unmeasured",
      campaign: null,
      detail: null,
      raw: null,
    };
  }

  const source = clean(attr.utmSource)?.toLowerCase() ?? null;
  const medium = clean(attr.utmMedium)?.toLowerCase() ?? null;
  const campaign = clean(attr.utmCampaign);
  const content = clean(attr.utmContent);
  const referrer = clean(attr.referrer);
  const raw = source ? [source, medium].filter(Boolean).join("/") : null;

  if (source === "shop") {
    const label = medium ? (SHOP_MEDIUMS[medium] ?? `Tienda: ${titleish(medium)}`) : "Tienda";
    return {
      key: `shop:${medium ?? "sin_medium"}`,
      label,
      group: "shop",
      campaign,
      // En `freebie_delivery` el content es el slug del freebie, que es lo
      // que dice CUÁL de ellos trae testers.
      detail: content,
      raw,
    };
  }

  if (source) {
    const group: BetaSourceGroup = EMAIL_SOURCES.has(source)
      ? "email"
      : SOCIAL_SOURCES.has(source)
        ? "social"
        : SEARCH_SOURCES.has(source)
          ? "search"
          : "web";
    const label =
      group === "email"
        ? `Email: ${campaign ?? medium ?? source}`
        : [titleish(source), medium ? titleish(medium) : null].filter(Boolean).join(": ");
    return {
      key: `${source}:${medium ?? "sin_medium"}`,
      label,
      group,
      campaign,
      detail: content,
      raw,
    };
  }

  if (referrer) {
    const h = host(referrer);
    if (h) {
      for (const [pattern, label, group] of HOST_LABELS) {
        if (pattern.test(h)) {
          return { key: `ref:${label.toLowerCase()}`, label, group, campaign: null, detail: h, raw: null };
        }
      }
      return { key: `ref:${h}`, label: h, group: "web", campaign: null, detail: h, raw: null };
    }
  }

  return {
    key: "direct",
    label: "Directo o sin origen",
    group: "direct",
    campaign: null,
    detail: null,
    raw: null,
  };
}

/**
 * Los orígenes que ESPERAMOS ver. Se pintan aunque estén a cero, porque un
 * cero aquí es información (el punto de contacto no está publicado, o está
 * publicado y no trae a nadie) y una fila ausente no dice nada.
 */
export const EXPECTED_BETA_SOURCES: Array<{ key: string; label: string; group: BetaSourceGroup; hint: string }> = [
  {
    key: "shop:freebie_delivery",
    label: "Tienda: email del freebie",
    group: "shop",
    hint: "buildFreebieEmailHtml en dp-studio",
  },
  {
    key: "shop:freebie_success",
    label: "Tienda: pantalla tras el claim",
    group: "shop",
    hint: "snippets/dp-freebie-claim.liquid",
  },
  {
    key: "shop:order_confirmation",
    label: "Tienda: email de pedido",
    group: "shop",
    hint: "shopify/notifications/order-confirmation-beta-block.html, pegado a mano",
  },
  {
    key: "email:newsletter",
    label: "Email: campaña de Brevo",
    group: "email",
    hint: "utm_source=email, la campaña beta_launch de agosto",
  },
];

const GROUP_LABELS: Record<BetaSourceGroup, string> = {
  shop: "Tienda",
  email: "Email",
  social: "Redes",
  search: "Buscadores",
  web: "Otra web",
  direct: "Directo",
  internal: "La propia web",
  unmeasured: "Sin medir",
};

export function betaSourceGroupLabel(group: BetaSourceGroup): string {
  return GROUP_LABELS[group];
}
