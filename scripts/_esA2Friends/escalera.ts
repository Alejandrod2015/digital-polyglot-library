// Solo lectura: escalera de recirculacion medida con LA MISMA funcion del gate
// (validateJourneyStories -> journey-vocab-recirculation), sin replicarla.
// Toma las historias guardadas del journey en orden de lectura; si se pasa un
// JSON de tema en borrador, sus historias sustituyen o se anaden a las guardadas.
// Fuerza conjuntoCompleto para que el check devuelva su medida en vez de "en espera".
//   npx tsx scripts/_esA2Friends/escalera.ts <journeyId> [borrador.json]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
const p = new PrismaClient();
(async () => {
  const [id, borrador] = process.argv.slice(2);
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true, levels: true, typeSlug: true,
    stories: { select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true } } } });
  if (!j) throw new Error("no existe " + id);
  const porClave = new Map(j.stories.filter((s) => s.text).map((s) => [`${s.topic}#${s.slotIndex}`, s as any]));
  if (borrador) for (const s of JSON.parse(fs.readFileSync(borrador, "utf8"))) porClave.set(`${s.topic}#${s.slotIndex}`, { ...s, slug: s.slug ?? `${s.topic}-${s.slotIndex}` });
  const orden = [...porClave.values()].sort((a, b) => j.topics.indexOf(a.topic) - j.topics.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  const level = j.levels[0].toUpperCase();
  const input = orden.map((s) => ({ slug: String(s.slug), title: String(s.title), text: String(s.text), vocab: s.vocab, language: "ES", level, topic: s.topic }));
  const run = (lv: string) => validateJourneyStories(input, { language: "ES", level: lv, realPeople: ["Zzzz"], conjuntoCompleto: true, journeyType: j.typeSlug, journeyId: id })
    .find((x) => x.id === "journey-vocab-recirculation");
  const c = run(level);
  // En pass el check no devuelve detalle. Para leer SUS cifras se vuelve a llamar
  // con el liston A0 (suelo 2,5, cola 30%), que no lo pasa nadie: media, cola y
  // ancladas no dependen del nivel, solo el veredicto y el tope impreso.
  const cifras = c?.detail ?? run("A0")?.detail;
  console.log(`${input.length} historias · veredicto ${level} (conjunto forzado): ${c?.status}\n${cifras}`);
  await p.$disconnect();
})();
