/**
 * La tabla del journey historia a historia: glosas, reparto portable/anclada
 * MEDIDO (no el que declara el autor) y la escalera de cada una.
 *
 *   Portables       = plazas cuya superficie aparece en OTRO cuerpo del journey.
 *   Ancladas        = las que solo viven en el suyo.
 *   Vistas antes    = plazas que ya habian salido en una historia ANTERIOR.
 *   Vuelven despues = plazas que reaparecen en una POSTERIOR.
 *   Escalera        = media de historias por plaza, formula del gate.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __r = createRequire(__filename);
try { const q = __r.resolve("server-only"); (__r as unknown as { cache: Record<string, unknown> }).cache[q] = { id: q, filename: q, loaded: true, exports: {} }; } catch {}
import { PrismaClient } from "../../src/generated/prisma";
import { getTapGlossesForSlug } from "../../src/lib/tapGlosses";
const p = new PrismaClient();
const J = process.argv[2] ?? "cmt70xfyt000l3283gxd70wck";
const TAP = /\p{L}+(?:-\p{L}+)*/gu;
type V = { word: string; surface?: string | null };
const clave = (v: V) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
const tok = (t: string) => new Set((t.toLowerCase().match(/\p{L}+/gu) ?? []));
(async () => {
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const st = (await p.journeyStory.findMany({
    where: { journeyId: J, text: { not: null } },
    select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true },
  })).sort((a, b) => (j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const cuerpos = st.map((s) => tok(s.text!));
  console.log(`| # | Historia | Glosas | Portables | Ancladas | Vistas antes | Vuelven después | Escalera |`);
  console.log(`|---|---|---|---|---|---|---|---|`);
  let TP = 0, TA = 0, TB = 0, TD = 0, N = 0, S = 0, TG = 0, TGT = 0;
  for (const [i, s] of st.entries()) {
    const g = getTapGlossesForSlug(s.slug!) ?? {};
    const tot = [...`${s.title} ${s.text}`.matchAll(TAP)];
    const cub = tot.filter((m) => g[m[0].toLowerCase()]).length;
    TG += cub; TGT += tot.length;
    let port = 0, antes = 0, despues = 0, suma = 0;
    const vocab = (s.vocab as V[]) ?? [];
    for (const v of vocab) {
      const k = clave(v);
      const donde = cuerpos.map((c, n) => (c.has(k) ? n : -1)).filter((n) => n >= 0);
      suma += donde.length;
      if (donde.some((n) => n !== i)) port++;
      if (donde.some((n) => n < i)) antes++;
      if (donde.some((n) => n > i)) despues++;
    }
    TP += port; TA += vocab.length - port; TB += antes; TD += despues; N += vocab.length; S += suma;
    const url = `http://localhost:3000/stories/${s.slug}`;
    console.log(`| ${i + 1} | [${s.title}](${url}) | ${cub}/${tot.length} | ${port} | ${vocab.length - port} | ${antes} | ${despues} | ${(suma / vocab.length).toFixed(2).replace(".", ",")} |`);
  }
  console.log(`| | **journey** | **${TG}/${TGT}** | **${TP}** | **${TA}** | **${TB}** | **${TD}** | **${(S / N).toFixed(2).replace(".", ",")}** |`);
})().finally(() => p.$disconnect());
