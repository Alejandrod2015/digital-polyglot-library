/** Corre el gate de journey sobre un journey YA guardado. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories, type JourneyStoryInput } from "../src/lib/validateJourneyStories";
const p = new PrismaClient();
async function main() {
  const id = process.argv[2];
  const j = await p.journey.findUnique({ where: { id }, select: { name: true, language: true, variant: true, levels: true, topics: true } });
  if (!j) throw new Error("no journey");
  const orden = j.topics ?? [];
  const filas = (await p.journeyStory.findMany({
    where: { journeyId: id }, select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const level = (process.argv[3] ?? (j.levels?.[0] ?? "a0")).toUpperCase();
  const todas: JourneyStoryInput[] = filas.filter((f) => String(f.text ?? "").trim()).map((f) => ({
    slug: f.slug ?? `${f.topic}#${f.slotIndex}`, title: f.title ?? "", text: String(f.text),
    vocab: f.vocab as never, language: j.language, level,
  }));
  const realPeople = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  console.log(`\n== ${j.name} ${j.language}/${j.variant} ${level} · ${todas.length} historias`);
  for (const c of validateJourneyStories(todas, { language: j.language, level, realPeople }))
    console.log(`   ${c.status === "pass" ? "ok  " : c.status === "fail" ? "FAIL" : "SIN IMPL"} [${c.id}] ${(c.detail ?? "").slice(0, 260)}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
