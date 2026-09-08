/** Clasifica las 58 plazas de color del B1 latam en tres cubos, porque no se
 *  arreglan igual y una de las tres NO se puede tocar.
 *
 *  A) FALSO POSITIVO del lexico: español corriente que el lexico graduado no
 *     tiene (ojalá, vid, yema, terciopelo). El gate las cuenta como color y no
 *     lo son.
 *  B) ANCLA CULTURAL en su PRIMERA aparicion del journey. La regla del usuario
 *     (feedback_cultural_anchor_always_vocab, "nunca puedes cometer ese
 *     error") las hace obligatorias en vocab. Quitarles la plaza es justo el
 *     error que prohibe.
 *  C) RE-ENSEÑANZA: el ancla ya ocupo plaza en una historia ANTERIOR de la
 *     secuencia. La misma regla dice que ahi no hay que re-enseñarla. Estas si
 *     se pueden liberar sin romper nada.
 *
 *  El cubo C se mide solo; A y B los separo leyendo. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";

const p = new PrismaClient();
const JOURNEY = "cmtmylg7k0007321h6t7njesx";

function fueraDelLexico(w: string): boolean {
  const x = w.trim().toLowerCase();
  if (!x || x.includes(" ")) return false;
  const formas = [x];
  if (x.endsWith("es") && x.length > 4) formas.push(x.slice(0, -2));
  if (x.endsWith("s") && x.length > 3) formas.push(x.slice(0, -1));
  return !formas.some((f) => isSpanishUpToLevel(f, "c1"));
}

(async () => {
  const j = await p.journey.findFirst({ where: { id: JOURNEY }, select: { topics: true } });
  const orden = (j?.topics ?? []) as string[];
  const hs = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, topic: true, slotIndex: true, vocab: true, audioUrl: true },
  });
  hs.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const ensenada = new Map<string, string>();   // palabra -> primera historia
  const repes: string[] = [];
  let color = 0, ancladas = 0;

  for (const h of hs) {
    const voc = (h.vocab as Array<{ word?: unknown; anchor?: unknown }>) ?? [];
    for (const v of voc) {
      const w = String(v?.word ?? "").toLowerCase();
      if (!w) continue;
      if (v?.anchor) ancladas++;
      if (!fueraDelLexico(w)) { if (!ensenada.has(w)) ensenada.set(w, h.slug ?? ""); continue; }
      color++;
      if (ensenada.has(w)) repes.push(`${h.slug} · ${w} (ya en ${ensenada.get(w)})`);
      else ensenada.set(w, h.slug ?? "");
    }
  }
  console.log(`plazas de color: ${color} · plazas ancladas en el journey: ${ancladas}`);
  console.log(`\nCUBO C, re-enseñanzas liberables sin tocar la regla: ${repes.length}`);
  for (const r of repes) console.log(`  ${r}`);
  console.log(`\nsi solo se liberan esas: ${color - repes.length} color, media ${((color - repes.length) / hs.length).toFixed(2)} (tope 1,5)`);
  await p.$disconnect();
})();
