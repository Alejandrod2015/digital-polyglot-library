import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
type V = { type?: string };
function tally(rows: { vocab: unknown }[]) {
  const c: Record<string, number> = {}; let total = 0;
  for (const r of rows) {
    const v = Array.isArray(r.vocab) ? (r.vocab as V[]) : [];
    for (const it of v) { const t = (it?.type || "sin type").toLowerCase(); c[t] = (c[t] ?? 0) + 1; total += 1; }
  }
  return { c, total };
}
const pct = (n: number, t: number) => `${((100 * n) / (t || 1)).toFixed(0)}%`;
(async () => {
  const finca = await p.catalogStory.findMany({ where: { slug: "la-finca-en-la-montana" }, select: { vocab: true } });
  const libro = await p.catalogStory.findMany({ where: { book: { slug: "colombian-spanish-stories-for-beginners" } }, select: { vocab: true } });
  const catalogo = await p.catalogStory.findMany({ where: { book: { published: true } }, select: { vocab: true } });
  const journeys = await p.journeyStory.findMany({ where: { vocab: { not: null } }, select: { vocab: true }, take: 400 });
  for (const [nombre, rows] of [["la-finca", finca], ["libro colombiano", libro], ["todo el catalogo", catalogo], ["journeys", journeys]] as const) {
    const { c, total } = tally(rows);
    const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const nouns = c["noun"] ?? 0;
    console.log(`${nombre.padEnd(18)} n=${String(total).padStart(5)}  sustantivos=${pct(nouns, total).padStart(4)}  | ${top.map(([k, v]) => `${k} ${pct(v, total)}`).join("  ")}`);
  }
  await p.$disconnect();
})();
