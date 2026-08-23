/** Mide de dónde salen los distractores de fill_blank del A1 latam: cuántos
 *  están fuera del nivel A1/A2 y cuántos son ajenos al mundo del journey. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { createRequire } from "module";
import { PrismaClient } from "../src/generated/prisma";
import { SPANISH_A1_A2_LEMMAS } from "../src/lib/cefr/spanishA1A2";
const __req = createRequire(__filename);
try { const sp = __req.resolve("server-only"); (__req as any).cache[sp] = { id: sp, filename: sp, loaded: true, exports: {} }; } catch {}
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(el|la|los|las|un|una)\s+/, "").trim();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { vocab: true, practiceSet: { select: { exercises: { select: { type: true, payload: true } } } } } });
  const propias = new Set<string>();
  for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) if (v?.word) propias.add(norm(String(v.word)));
  const nivel = new Set([...SPANISH_A1_A2_LEMMAS].map(norm));
  let total = 0, fueraNivel = 0, ajenos = 0;
  const ejemplos: string[] = [];
  for (const s of st) for (const e of s.practiceSet?.exercises ?? []) {
    if (e.type !== "fill_blank") continue;
    const pay = e.payload as { options?: string[]; answer?: string } | null;
    if (!pay?.options || !pay.answer) continue;
    for (const o of pay.options) {
      if (norm(o) === norm(pay.answer)) continue;
      total++;
      // Misma regla que el arreglo: una locucion se juzga por su CABEZA.
      const cabeza = norm(o).split(/\s+/).pop() ?? "";
      const enNivel = nivel.has(cabeza) || nivel.has(norm(o));
      const propia = propias.has(norm(o));
      if (!enNivel) { fueraNivel++; if (ejemplos.length < 14) ejemplos.push(o); }
      if (!propia) ajenos++;
    }
  }
  console.log(`distractores de fill_blank: ${total}`);
  console.log(`  fuera de la lista A1/A2: ${fueraNivel} (${Math.round(100*fueraNivel/total)}%)`);
  console.log(`  ajenos al vocab del journey: ${ajenos} (${Math.round(100*ajenos/total)}%)`);
  console.log(`  ejemplos fuera de nivel: ${ejemplos.join(", ")}`);
  await p.$disconnect();
})();
