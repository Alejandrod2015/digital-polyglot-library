/**
 * Renombra los 7 temas del Friends DE A0 al nivel de dominio (aprobado por el
 * usuario el 2026-09-13 via Journey-planning). Cambia label y slug de cada Topic,
 * Journey.topics y el campo `topic` de las historias; no toca texto ni vocab.
 * Los slugs viejos solo los usa este journey (se crearon el mismo dia).
 *
 *   npx tsx scripts/_renameFriendsDEa0Topics.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";

const prisma = new PrismaClient();
const JOURNEY = "cmu047bkz0007326jsgeptkox";
const RENAME: Array<[string, string, string]> = [
  ["postcards-and-stamps", "letters-and-invitations", "Letters & Invitations"],
  ["photos-and-faces", "looks-and-memories", "Looks & Memories"],
  ["board-games-and-dice", "games-and-rules", "Games & Rules"],
  ["books-and-newspapers", "books-and-reading", "Books & Reading"],
  ["songs-and-instruments", "music-and-singing", "Music & Singing"],
  ["pots-and-spoons", "cooking-and-hosting", "Cooking & Hosting"],
  ["notes-and-magnets", "plans-and-decisions", "Plans & Decisions"],
];

async function main() {
  const dry = process.argv.includes("--dry");
  await assertTopicsGrounded({
    language: "German",
    proposals: RENAME.map(([, slug, label]) => ({ label, slug })),
    journeyEvidence: ["Now I would like to reconnect with my friends", "I made a lot of German friends", "to be able to read and possibly correspond in German"],
    prisma,
  });
  const otros = await prisma.journey.findMany({ where: { id: { not: JOURNEY } }, select: { id: true, topics: true } });
  const usados = new Set(otros.flatMap((j) => j.topics));
  const choques = RENAME.filter(([viejo, nuevo]) => usados.has(viejo) || usados.has(nuevo));
  if (choques.length) throw new Error(`slugs usados por otro journey: ${choques.map((c) => c[0]).join(", ")}`);
  const j = await prisma.journey.findUniqueOrThrow({ where: { id: JOURNEY }, select: { topics: true } });
  const nuevosTopics = j.topics.map((t) => RENAME.find(([v]) => v === t)?.[1] ?? t);
  console.log("Journey.topics:", nuevosTopics.join(", "));
  if (dry) { console.log("[--dry] nada escrito."); return; }
  await prisma.$transaction(async (tx) => {
    for (const [viejo, nuevo, label] of RENAME) {
      await tx.topic.update({ where: { slug: viejo }, data: { slug: nuevo, label } });
      const r = await tx.journeyStory.updateMany({ where: { journeyId: JOURNEY, topic: viejo }, data: { topic: nuevo } });
      console.log(`${viejo} -> ${nuevo} (${label}) · ${r.count} filas de historia`);
    }
    await tx.journey.update({ where: { id: JOURNEY }, data: { topics: nuevosTopics } });
  });
}
main().catch((e) => { console.error("FALLO:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
