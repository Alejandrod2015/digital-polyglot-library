/**
 * Corre el GATE DE JOURNEY (reglas de conjunto) sobre un journey YA GUARDADO,
 * sin escribir nada. El gate vive dentro de saveStory, así que un journey
 * escrito ANTES de que existiera nunca se midió con él.
 *
 *   npx tsx --conditions react-server scripts/_auditJourneyRules.ts <journeyId>
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories, type JourneyStoryInput } from "../src/lib/validateJourneyStories";
const p = new PrismaClient();
async function main() {
  const id = process.argv[2];
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true, language: true, levels: true } });
  const filas = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } },
    select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true } });
  const orden = j?.topics ?? [];
  filas.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const nivel = (j?.levels ?? [])[0] ?? "";
  const todas: JourneyStoryInput[] = filas.map((f) => ({
    slug: f.slug ?? `${f.topic}#${f.slotIndex}`, title: f.title ?? "", text: f.text!,
    vocab: f.vocab as never, language: j?.language ?? undefined, level: nivel,
  }));
  const realPeople = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const jc = validateJourneyStories(todas, { language: j?.language ?? undefined, level: nivel, realPeople });
  console.log(`── gate de journey · ${todas.length} historias · ${j?.language} ${nivel} ──`);
  for (const c of jc) console.log(`${c.status === "pass" ? "ok   " : c.status === "fail" ? "FAIL " : "SIN GATE"} [${c.id}] ${c.detail ?? ""}`);
  const malos = jc.filter((c) => c.status !== "pass");
  console.log(`\n${malos.length ? "✗ " + malos.length + " regla(s) de conjunto sin cumplir" : "✓ todas las reglas de conjunto en verde"}`);
  await p.$disconnect();
}
main();
