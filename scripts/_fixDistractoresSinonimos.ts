/**
 * Siete filas de `StoryPracticeExercise` (meaning_in_context, espanol) con un
 * distractor que era otro sentido de la misma palabra, confirmadas por el
 * chat de planificacion el 2026-09-20 sobre la salida de
 * `scripts/checkDistractorSynonyms.ts`. Solo toca `payload.options` (y en
 * "opinar" tambien `payload.answer`, porque las opciones traducian la frase
 * "¿qué opina?" y no el verbo, y el movil pinta la palabra sin la frase).
 * Cada sustituto es la glosa de otra palabra de la MISMA historia y del
 * MISMO tipo gramatical. No toca texto ni vocab de historias.
 *
 *   npx tsx scripts/_fixDistractoresSinonimos.ts --dry
 *   npx tsx scripts/_fixDistractoresSinonimos.ts
 *
 * Se niega a escribir si las opciones actuales no son las esperadas.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const dry = process.argv.includes("--dry");

type Fix = { id: string; story: string; word: string; expect: string[]; options: string[]; answer?: string };

const FIXES: Fix[] = [
  { id: "spe_mu6wbyja5w8dykz", story: "muy-interesante", word: "contar",
    expect: ["to tell", "to count", "to ask", "to hide"],
    options: ["to tell", "to send", "to ask", "to hide"] },
  { id: "spe_mu6wbz6ednpuj99", story: "muy-interesante", word: "llevar",
    expect: ["to have been for", "to bring along", "to take away", "to carry out"],
    options: ["to have been for", "to remember", "to send", "to write"] },
  { id: "spe_mu6wa1q85047d3q", story: "lo-que-si-se-acepta", word: "echar",
    expect: ["to pour", "to throw away", "to weigh", "to taste"],
    options: ["to pour", "to lend", "to weigh", "to taste"] },
  { id: "cmt7a4umq004f3267fdjdae19", story: "carla-paga-sin-probar-la-horchata", word: "caliente",
    expect: ["served him", "warm", "hot to the touch, not cold at all", "to put up with (Argentine slang)"],
    options: ["served him", "soft", "hot to the touch, not cold at all", "to put up with (Argentine slang)"] },
  { id: "spe_mu6wcmrlf08xpls", story: "nerja-huele-a-pan", word: "mañana",
    expect: ["tomorrow", "tonight", "last week", "this morning"],
    options: ["tomorrow", "tonight", "last week", "a greeting"] },
  { id: "spe_mu6we3av4smu4za", story: "pase-manana", word: "caja",
    expect: ["the till", "the box of tools", "the door", "the book"],
    options: ["the till", "the prize", "the door", "the book"] },
  { id: "spe_mu6wkz8n1fmk7pj", story: "un-tinto-que-nadie-pidio", word: "opinar",
    expect: ["what do you think", "what do you sell", "what do you pay", "what do you hear"],
    options: ["to give an opinion", "to sell", "to pay", "to hear"], answer: "to give an opinion" },
];

async function main() {
  console.log("| historia | palabra | antes | despues |");
  console.log("| --- | --- | --- | --- |");
  for (const f of FIXES) {
    const row = await prisma.storyPracticeExercise.findUnique({ where: { id: f.id }, select: { word: true, payload: true } });
    if (!row) throw new Error(`${f.id} no existe`);
    const payload = row.payload as Record<string, unknown>;
    const current = payload.options as string[];
    if (JSON.stringify(current) !== JSON.stringify(f.expect)) {
      throw new Error(`${f.story}/${f.word}: opciones distintas de las esperadas: ${JSON.stringify(current)}`);
    }
    const next = { ...payload, options: f.options, ...(f.answer ? { answer: f.answer } : {}) };
    console.log(`| ${f.story} | ${f.word} | ${current.join(" / ")} | ${f.options.join(" / ")}${f.answer ? ` (answer: ${f.answer})` : ""} |`);
    if (!dry) await prisma.storyPracticeExercise.update({ where: { id: f.id }, data: { payload: next } });
  }
  console.log(dry ? "\n--dry: nada escrito" : `\n${FIXES.length} filas escritas`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
