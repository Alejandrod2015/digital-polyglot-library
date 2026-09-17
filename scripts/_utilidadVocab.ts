/** Cuantas plazas de vocab caen FUERA del lexico graduado (ni siquiera C1):
 *  color local que ocupa una plaza y acaba en los ejercicios. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";

/** El lexico graduado no resuelve plurales: "rojas" o "plumas" salian fuera de
 *  nivel siendo A1. Se prueba la forma tal cual, sin -s y sin -es. */
export function fueraDelLexico(w: string): boolean {
  const x = w.trim().toLowerCase();
  if (!x || x.includes(" ")) return false;
  const formas = [x];
  if (x.endsWith("es") && x.length > 4) formas.push(x.slice(0, -2));
  if (x.endsWith("s") && x.length > 3) formas.push(x.slice(0, -1));
  return !formas.some((f) => isSpanishUpToLevel(f, "c1"));
}
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({
    where: { language: "spanish", status: { not: "archived" } },
    select: { id: true, name: true, variant: true, levels: true, status: true },
  });
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { slug: true, vocab: true } });
    const porHistoria: number[] = [];
    const ejemplos: string[] = [];
    for (const s of st) {
      const voc = ((s.vocab as Array<{ word?: unknown }>) ?? []).map((v) => String(v?.word ?? ""));
      const fuera = voc.filter((w) => fueraDelLexico(w));
      if (voc.length) porHistoria.push(fuera.length);
      if (fuera.length >= 4 && ejemplos.length < 2) ejemplos.push(`${s.slug}: ${fuera.join(", ")}`);
    }
    if (!porHistoria.length) continue;
    const tot = porHistoria.reduce((a, b) => a + b, 0);
    const max = Math.max(...porHistoria);
    const media = (tot / porHistoria.length).toFixed(1);
    console.log(`${j.status === "active" ? "LIVE " : "draft"} ${j.name} ${j.variant} ${j.levels.join("/")} · media ${media}/20 · peor ${max} · total ${tot}`);
    for (const e of ejemplos) console.log(`        ${e}`);
  }
  await p.$disconnect();
})();
