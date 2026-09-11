/** SOLO LECTURA. Para cada historia del bundle PT B1: cada forma tocable no
 *  exenta (TAPPABLE del lector), la oracion donde sale por primera vez, la
 *  glosa global actual si existe y la plaza de vocab si lo es. Escribe un JSON
 *  por tema en <dir>/in_<tema>.json. Uso: npx tsx scripts/_pt/glosasVolcado.ts <dir> */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const B = "portuguese-traveler-brazil-b1", J = "cmtrcpgso00073232h8vaf7na";
const TAP = /\p{L}[\p{L}\p{M}'-]*/gu;
const p = new PrismaClient();
(async () => {
  const dir = process.argv[2];
  const ex = JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles[B];
  const exentas = new Set<string>([...ex.articles, ...ex.numerals, ...ex.characterNames, ...(ex.placeNames ?? [])].map((w: string) => w.toLowerCase()));
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } }, select: { glosses: true } });
  const glob = (g?.glosses ?? {}) as Record<string, { g?: string; t?: string; rev?: boolean }>;
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const st = await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, title: true, text: true, topic: true, slotIndex: true, vocab: true } });
  st.sort((a, b) => j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  let total = 0, sinGlobal = 0;
  const porTema: Record<string, unknown[]> = {};
  for (const s of st) {
    const cuerpo = `${s.title ?? ""}.\n${s.text ?? ""}`;
    const oraciones = cuerpo.replace(/\n+/g, " ").split(/(?<=[.!?”])\s+/).filter((o) => o.trim());
    const vocab = new Map<string, { word: string; type?: string; definition?: string }>();
    for (const v of (s.vocab ?? []) as Array<{ word: string; surface?: string; type?: string; definition?: string }>) vocab.set(String(v.surface ?? v.word).toLowerCase(), v);
    const formas: Record<string, unknown> = {};
    for (const o of oraciones) for (const m of o.match(TAP) ?? []) {
      const k = m.toLowerCase();
      if (exentas.has(k) || formas[k]) continue;
      const gl = glob[k];
      formas[k] = { forma: m, oracion: o.trim(), global: gl ? `${gl.g} (${gl.t})${gl.rev === false ? " [copia sin leer]" : ""}` : null, vocab: vocab.get(k) ? `${vocab.get(k)!.word} · ${vocab.get(k)!.type} · ${vocab.get(k)!.definition}` : null };
      total++; if (!gl) sinGlobal++;
    }
    (porTema[s.topic] ??= []).push({ slug: s.slug, title: s.title, text: s.text, formas });
  }
  for (const [t, v] of Object.entries(porTema)) fs.writeFileSync(`${dir}/in_${t}.json`, JSON.stringify(v, null, 1));
  console.log(`formas tocables por historia (suma de las 21): ${total} · sin glosa global hoy: ${sinGlobal}`);
  for (const [t, v] of Object.entries(porTema)) console.log(`${t}: ${(v as Array<{ formas: object }>).map((x) => Object.keys(x.formas).length).join(" / ")}`);
})().finally(() => p.$disconnect());
