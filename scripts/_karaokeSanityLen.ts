/** ¿Sanity conserva el texto COMPLETO de las historias recortadas? */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const pid = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const ds = process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET;
const ver = process.env.SANITY_API_VERSION || "2024-01-01";
const tok = process.env.SANITY_API_WRITE_TOKEN;
const wc = (s: string) => String(s || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
(async () => {
  const slugs = process.argv[2].split(",");
  const q = `*[_type=="story" && slug.current in $slugs]{ "slug": slug.current, text, _updatedAt }`;
  const url = `https://${pid}.api.sanity.io/v${ver}/data/query/${ds}?query=${encodeURIComponent(q)}&$slugs=${encodeURIComponent(JSON.stringify(slugs))}`;
  const res = await fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
  const data = (await res.json()) as { result?: Array<{ slug: string; text?: string; _updatedAt?: string }> };
  const bySlug = new Map((data.result ?? []).map((r) => [r.slug, r]));
  console.log(`${"historia".padEnd(36)}${"base".padStart(7)}${"sanity".padStart(8)}${"falta".padStart(8)}   veredicto`);
  for (const slug of slugs) {
    const row = await p.catalogStory.findFirst({ where: { slug }, select: { text: true } });
    const s = bySlug.get(slug);
    const a = wc(row?.text ?? "");
    const b = wc(s?.text ?? "");
    const verdict = !s ? "no esta en sanity" : b > a * 1.25 ? "SANITY TIENE EL COMPLETO" : b > a * 1.05 ? "sanity algo mas largo" : "sanity igual de corto";
    console.log(`${slug.slice(0, 35).padEnd(36)}${String(a).padStart(7)}${String(b).padStart(8)}${String(b - a).padStart(8)}   ${verdict}`);
  }
  await p.$disconnect();
})();
