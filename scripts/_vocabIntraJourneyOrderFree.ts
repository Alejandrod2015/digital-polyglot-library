/**
 * Variante de `_vocabIntraJourney.ts` para los tipos de journey cuyo orden de
 * lectura es LIBRE (Traveler, Cultural, Relationships, Hospitality, Business,
 * Health): ahí "historia posterior" no significa nada, porque el alumno elige
 * el tema. Cuenta el reencuentro en CUALQUIER otra historia del journey.
 *
 * Solo lectura. Mismo emparejamiento por raíz que el original, para que las
 * dos cifras sean comparables.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

const strip = (w: string) =>
  w.replace(/^(der|die|das|den|dem|el|la|los|las|un|una|il|lo|le|gli|i|un')\s+/i, "").trim();
const tok = (s: string) => (s.toLowerCase().match(/\p{L}+/gu) ?? []);
function stem(w: string): string {
  const t = tok(w);
  if (!t.length) return "";
  const head = t.sort((a, b) => b.length - a.length)[0];
  if (head.length <= 4) return head;
  return head.slice(0, Math.max(4, head.length - 3));
}
const count = (tokens: string[], st: string) =>
  st ? tokens.filter((t) => t.length >= st.length && t.startsWith(st)).length : 0;

const ORDEN_OBLIGADO = new Set(["expat", "academic"]);

async function main() {
  const journeys = await prisma.journey.findMany({
    where: { status: { notIn: ["archived"] } },
    select: {
      name: true, language: true, variant: true, status: true, typeSlug: true, topics: true, storiesPerTopic: true,
      stories: { select: { topic: true, slotIndex: true, level: true, text: true, vocab: true } },
    },
  });
  let gTot = 0, gPost = 0, gAny = 0;
  for (const j of journeys) {
    const per = Math.max(1, j.storiesPerTopic || 1);
    const stories = j.stories
      .filter((s) => (s.text ?? "").length > 0)
      .map((s) => ({ ...s, pos: (j.topics.indexOf(s.topic) < 0 ? 999 : j.topics.indexOf(s.topic)) * per + (s.slotIndex ?? 0), tokens: tok(s.text ?? "") }))
      .sort((a, b) => a.pos - b.pos);
    if (!stories.length) continue;
    let tot = 0, noPost = 0, noAny = 0;
    for (const s of stories) {
      const vocab = Array.isArray(s.vocab) ? (s.vocab as Array<Record<string, unknown>>) : [];
      const later = stories.filter((o) => o.pos > s.pos).flatMap((o) => o.tokens);
      const others = stories.filter((o) => o.pos !== s.pos).flatMap((o) => o.tokens);
      for (const v of vocab) {
        const st = stem(strip(String(v.word ?? "")));
        if (!st) continue;
        tot++;
        if (count(later, st) === 0) noPost++;
        if (count(others, st) === 0) noAny++;
      }
    }
    gTot += tot; gPost += noPost; gAny += noAny;
    const orden = ORDEN_OBLIGADO.has(j.typeSlug ?? "") ? "OBLIGADO" : "libre";
    const lvl = stories[0]?.level ?? "?";
    console.log(
      `${`${j.name} ${String(j.language).slice(0, 2).toUpperCase()}/${j.variant} ${lvl}`.padEnd(32)} ${orden.padEnd(8)} ` +
      `sin reencuentro POSTERIOR ${String(Math.round((noPost / tot) * 100)).padStart(3)}%  ·  en NINGUNA otra ${String(Math.round((noAny / tot) * 100)).padStart(3)}%`
    );
  }
  console.log(`\nTOTAL ${gTot} entradas · sin posterior ${Math.round((gPost / gTot) * 100)}% · sin ninguna ${Math.round((gAny / gTot) * 100)}%`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
