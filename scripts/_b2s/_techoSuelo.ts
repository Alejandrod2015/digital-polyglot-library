import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { spanishInfinitiveOf } from "../../src/lib/cefr/spanishConjugations";
const p = new PrismaClient();
const J = "cmtplpfum0007j8c6piegwt31";
const NOMBRES = new Set(["claudia","marcos","carla","pablo","hugo","alba","martina","paula","cádiz","vitoria"]);
(async () => {
  const hs = await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true } });
  const otros = await p.journeyStory.findMany({ where: { journeyId: { not: J }, journey: { language: "spanish", status: { in: ["active", "draft"] } } }, select: { vocab: true } });
  const fuera = new Set<string>(); for (const o of otros) for (const v of (o.vocab as any[]) ?? []) fuera.add(String(v.word).toLowerCase());
  let actual = 0, techoLibre = 0, techoSinSolape = 0;
  const filas: string[] = [];
  for (const h of hs.sort((a, b) => a.topic!.localeCompare(b.topic!) || Number(a.slotIndex) - Number(b.slotIndex))) {
    const voc = ((h.vocab as any[]) ?? []).map((v) => String(v.word).toLowerCase());
    const deNivel = voc.filter((w) => !isSpanishUpToLevel(w, "a2"));
    const enVocab = new Set(voc);
    const cand = new Set<string>();
    for (const m of h.text!.toLowerCase().matchAll(/\p{L}+/gu)) {
      const t = m[0]; if (NOMBRES.has(t) || t.length < 4) continue;
      const lema = spanishInfinitiveOf(t) ?? t;
      if (!isSpanishUpToLevel(lema, "a2") && isSpanishUpToLevel(lema, "c1") && !enVocab.has(lema)) cand.add(lema);
    }
    const sinSolape = [...cand].filter((l) => !fuera.has(l));
    const libres = voc.length - deNivel.length;
    const a = Math.min(voc.length, deNivel.length + Math.min(libres, cand.size));
    const b = Math.min(voc.length, deNivel.length + Math.min(libres, sinSolape.length));
    actual += deNivel.length; techoLibre += a; techoSinSolape += b;
    filas.push(`${h.slug.padEnd(28)} ahora ${String(deNivel.length).padStart(2)}/20 · candidatas ${String(cand.size).padStart(2)} (sin solape ${String(sinSolape.length).padStart(2)}) · techo ${a}/${b} · ${sinSolape.slice(0, 8).join(", ")}`);
  }
  console.log(filas.join("\n"));
  console.log(`\nJOURNEY: ahora ${actual}/420 (${(100 * actual / 420).toFixed(1)}%) · techo solo moviendo plazas ${techoLibre}/420 (${(100 * techoLibre / 420).toFixed(1)}%) · techo sin palabras ya ensenadas en otro journey ES ${techoSinSolape}/420 (${(100 * techoSinSolape / 420).toFixed(1)}%)`);
  await p.$disconnect();
})();
