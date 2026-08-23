// Cuanto vende el blog. Cruza los pedidos de Shopify (atribuidos por el
// landing_site, que es donde viajan las UTM) con las visitas propias de
// dp_page_visits_v1, que cubren el 100% del trafico sin depender de consentimiento.
//
//   node scripts/_blogSalesReport.mjs [dias]
import fs from "node:fs";

const DAYS = Number(process.argv[2] || 0);
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));

const DOMAIN = env.SHOPIFY_STORE_DOMAIN;
const TOKEN = env.SHOPIFY_ADMIN_TOKEN;

async function allOrders(since) {
  let url = `https://${DOMAIN}/admin/api/2024-10/orders.json?status=any&limit=250&created_at_min=${since}`;
  const out = [];
  while (url) {
    const r = await fetch(url, { headers: { "X-Shopify-Access-Token": TOKEN } });
    if (!r.ok) throw new Error(`shopify ${r.status} ${await r.text()}`);
    const j = await r.json();
    out.push(...j.orders);
    const link = r.headers.get("link") || "";
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : null;
  }
  return out;
}

/** De donde vino el pedido. El primer caso que encaja manda. */
function bucket(o) {
  const land = (o.landing_site || "").toLowerCase();
  const ref = (o.referring_site || "").toLowerCase();
  const q = new URLSearchParams(land.includes("?") ? land.slice(land.indexOf("?") + 1) : "");
  const src = (q.get("utm_source") || "").toLowerCase();
  const med = (q.get("utm_medium") || "").toLowerCase();

  if (src === "blog") return "blog (UTM)";
  if (/digitalpolyglot\.com\/blog|\/blog\//.test(ref)) return "blog (referrer)";
  if (med === "paid" || land.includes("fbclid") || ["facebook", "instagram", "ig", "fb"].includes(src)) return "pago social";
  if (/google\.|bing\.|duckduckgo|search\.yahoo|ecosia/.test(ref)) return "buscador";
  if (/instagram\.com|facebook\.com|t\.co|tiktok|pinterest|linkedin/.test(ref)) return "social organico";
  if (src === "email" || med === "email" || /klaviyo|brevo|mailchimp/.test(land)) return "correo";
  if (/digitalpolyglot\.com/.test(ref)) return "resto del sitio";
  if (ref) return "otro referrer";
  return "directo / sin señal";
}

function campaignOf(o) {
  const land = (o.landing_site || "");
  const q = new URLSearchParams(land.includes("?") ? land.slice(land.indexOf("?") + 1) : "");
  return (q.get("utm_campaign") || q.get("utm_content") || "").toLowerCase();
}

const money = (o) => Number(o.total_price_set?.shop_money?.amount ?? o.total_price ?? 0);

const since = DAYS
  ? new Date(Date.now() - DAYS * 864e5).toISOString()
  : "2026-05-17T00:00:00Z"; // arranque de dp_page_visits_v1

const raw = await allOrders(since);
const orders = raw.filter((o) => !o.test && !o.cancelled_at);

const byBucket = new Map();
const byCampaign = new Map();
const byProduct = new Map();
let gross = 0;

for (const o of orders) {
  const b = bucket(o);
  const m = money(o);
  gross += m;
  const cur = byBucket.get(b) || { n: 0, eur: 0 };
  cur.n++; cur.eur += m; byBucket.set(b, cur);

  if (b.startsWith("blog")) {
    const c = campaignOf(o) || "(sin campaña)";
    const cc = byCampaign.get(c) || { n: 0, eur: 0 };
    cc.n++; cc.eur += m; byCampaign.set(c, cc);
    for (const li of o.line_items || []) {
      const p = byProduct.get(li.title) || { n: 0, eur: 0 };
      p.n += li.quantity; p.eur += Number(li.price) * li.quantity; byProduct.set(li.title, p);
    }
  }
}

const pct = (x) => ((100 * x) / (gross || 1)).toFixed(1) + "%";
console.log(JSON.stringify({
  ventana: { desde: since, hasta: new Date().toISOString() },
  pedidos: orders.length,
  descartados: raw.length - orders.length,
  ingreso_total_eur: Math.round(gross * 100) / 100,
  buckets: [...byBucket.entries()].sort((a, b) => b[1].eur - a[1].eur)
    .map(([k, v]) => ({ fuente: k, pedidos: v.n, eur: Math.round(v.eur * 100) / 100, cuota: pct(v.eur) })),
  blog_por_post: [...byCampaign.entries()].sort((a, b) => b[1].eur - a[1].eur)
    .map(([k, v]) => ({ campana: k, pedidos: v.n, eur: Math.round(v.eur * 100) / 100 })),
  blog_por_producto: [...byProduct.entries()].sort((a, b) => b[1].eur - a[1].eur)
    .map(([k, v]) => ({ producto: k, uds: v.n, eur: Math.round(v.eur * 100) / 100 })),
}, null, 1));
