/** La tabla del journey, una fila por historia, con la escalera por historia. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const id = "cmt5vx8du000732fjgkwi59ks";
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const filas = (await p.journeyStory.findMany({
    where: { journeyId: id },
    select: { topic: true, slotIndex: true, title: true, slug: true, wordCount: true, vocab: true, text: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = filas.map((f) => new Set(tok(String(f.text ?? ""))));
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(el|la|los|las)\s+/, "");
  const w = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  console.log("#|historia|slug|palabras|citada|plazas|escalera|salen 1 vez");
  filas.forEach((f, i) => {
    const t = String(f.text ?? "");
    let dentro = 0;
    for (const m of t.matchAll(/“([^”]*)”/g)) dentro += w(m[1]);
    const voc = (f.vocab as any[]) ?? [];
    const enc = voc.map((v) => cuerpos.filter((c) => c.has(clave(v))).length);
    const media = enc.length ? enc.reduce((a, b) => a + b, 0) / enc.length : 0;
    console.log([i + 1, f.title, f.slug, f.wordCount, `${Math.round((100 * dentro) / w(t))}%`,
      voc.length, media.toFixed(2).replace(".", ","), enc.filter((n) => n <= 1).length].join("|"));
  });
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
