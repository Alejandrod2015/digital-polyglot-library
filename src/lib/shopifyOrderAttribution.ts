// Saca del payload del webhook de pedidos de Shopify el origen de la compra
// y lo reduce a un canal. Funcion pura: no toca la base, para poder probarla
// con pedidos reales pegados a mano.
//
// El origen viaja en dos campos del pedido: `landing_site` (primera pagina de
// la sesion que compro, con su query, donde van las UTM y el fbclid) y
// `referring_site` (de donde venia esa sesion). Shopify pinta en el admin
// "1st session from Instagram" con estos mismos datos.

export type OrderChannel =
  | "meta_paid"
  | "meta_organic"
  | "dp_web"
  | "google"
  | "email"
  | "referral"
  | "direct"
  | "unknown";

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  meta_paid: "Meta de pago",
  meta_organic: "Meta organico",
  dp_web: "Web Digital Polyglot",
  google: "Google",
  email: "Correo",
  referral: "Otra web",
  direct: "Directo",
  unknown: "Sin datos",
};

export type ShopifyOrderRecord = {
  id: string;
  name: string;
  orderedAt: Date;
  totalShop: string;
  shopCurrency: string;
  totalPaid: string;
  paidCurrency: string;
  channel: OrderChannel;
  landingSite: string | null;
  referringSite: string | null;
  sourceName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  hasFbclid: boolean;
  country: string | null;
  items: string[];
};

type Money = { amount?: string; currency_code?: string };

type OrderPayload = {
  id?: number | string;
  name?: string;
  created_at?: string;
  total_price?: string;
  currency?: string;
  presentment_currency?: string;
  total_price_set?: { shop_money?: Money; presentment_money?: Money };
  landing_site?: string | null;
  referring_site?: string | null;
  source_name?: string | null;
  shipping_address?: { country_code?: string | null } | null;
  billing_address?: { country_code?: string | null } | null;
  line_items?: Array<{ title?: string }>;
};

const META_HOSTS = /(^|\.)(facebook\.com|instagram\.com|fb\.com|fb\.me|messenger\.com|threads\.net)$/i;
const META_SOURCES = /^(facebook|instagram|fb|ig|meta|an|msg|threads)$/i;
const PAID_MEDIUMS = /^(paid|cpc|ppc|paidsocial|paid_social|paid-social|ads?|cpm)$/i;

function clip(value: string | null | undefined, max = 1000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** `landing_site` suele venir como ruta ("/products/x?utm_source=..."); a veces, absoluta. */
function paramsOf(landing: string | null): URLSearchParams {
  if (!landing) return new URLSearchParams();
  try {
    return new URL(landing, "https://shop.digitalpolyglot.com").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export function classifyChannel(input: {
  landingSite: string | null;
  referringSite: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  hasFbclid: boolean;
}): OrderChannel {
  const source = input.utmSource?.toLowerCase() ?? "";
  const medium = input.utmMedium?.toLowerCase() ?? "";
  const refHost = hostOf(input.referringSite);

  const metaSource = META_SOURCES.test(source);
  if (metaSource && PAID_MEDIUMS.test(medium)) return "meta_paid";
  // Sin UTM de pago, el fbclid solo dice que el clic salio de Meta, no que
  // fuera un anuncio: tambien lo llevan los enlaces de un post organico.
  if (metaSource || input.hasFbclid || (refHost && META_HOSTS.test(refHost))) {
    return "meta_organic";
  }

  if (source.includes("digitalpolyglot")) return "dp_web";
  if (refHost && refHost.endsWith("digitalpolyglot.com") && !refHost.startsWith("shop.")) {
    return "dp_web";
  }

  if (medium === "email" || source === "email" || source === "newsletter") return "email";
  if (source === "google" || (refHost && /(^|\.)google\./.test(refHost))) return "google";
  if (refHost && !refHost.endsWith("digitalpolyglot.com") && !refHost.endsWith("myshopify.com")) {
    return "referral";
  }
  if (source) return "referral";
  if (input.landingSite) return "direct";
  return "unknown";
}

export function parseShopifyOrder(payload: unknown): ShopifyOrderRecord | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as OrderPayload;
  if (o.id === undefined || o.id === null || !o.created_at) return null;

  const landingSite = clip(o.landing_site);
  const referringSite = clip(o.referring_site);
  const params = paramsOf(landingSite);
  const utm = (key: string) => clip(params.get(key), 200);
  const utmSource = utm("utm_source");
  const utmMedium = utm("utm_medium");
  const hasFbclid = params.has("fbclid");

  const shop = o.total_price_set?.shop_money;
  const paid = o.total_price_set?.presentment_money;

  return {
    id: String(o.id),
    name: clip(o.name, 50) ?? String(o.id),
    orderedAt: new Date(o.created_at),
    totalShop: shop?.amount ?? o.total_price ?? "0",
    shopCurrency: shop?.currency_code ?? o.currency ?? "EUR",
    totalPaid: paid?.amount ?? o.total_price ?? "0",
    paidCurrency: paid?.currency_code ?? o.presentment_currency ?? o.currency ?? "EUR",
    channel: classifyChannel({ landingSite, referringSite, utmSource, utmMedium, hasFbclid }),
    landingSite,
    referringSite,
    sourceName: clip(o.source_name, 100),
    utmSource,
    utmMedium,
    utmCampaign: utm("utm_campaign"),
    utmContent: utm("utm_content"),
    utmTerm: utm("utm_term"),
    hasFbclid,
    country: clip(o.shipping_address?.country_code ?? o.billing_address?.country_code, 2),
    items: (o.line_items ?? []).map((i) => clip(i.title, 200)).filter((t): t is string => Boolean(t)),
  };
}
