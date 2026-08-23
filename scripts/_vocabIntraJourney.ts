/**
 * ¿Cuánto del vocabulario que enseña un journey se vuelve a ver DENTRO del
 * mismo journey? Unidad de exposición garantizada: las 21 historias de un
 * journey se leen en orden; que el alumno abra otro journey no lo garantiza
 * nadie.
 *
 * Por cada entrada de vocab enseñada en la historia P (orden de lectura =
 * indice del tema * historias por tema + slotIndex), cuenta:
 *   - repeticiones dentro de su PROPIA historia (mismo texto)
 *   - apariciones en historias POSTERIORES del mismo journey
 * Emparejamiento por raiz (prefijo tolerante a 3 caracteres de flexion), no
 * por forma exacta, para no contar 'genießt' como distinto de 'genießen'.
 * SOLO LECTURA.
 */
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

const strip = (w: string) =>
  w.replace(/^(der|die|das|den|dem|el|la|los|las|un|una|il|lo|le|gli|i|un')\s+/i, "").trim();
const tok = (s: string) => (s.toLowerCase().match(/\p{L}+/gu) ?? []);

/** Raiz tolerante: recorta hasta 3 caracteres de flexion, minimo 4. */
function stem(w: string): string {
  const t = tok(w);
  if (!t.length) return "";
  const head = t.sort((a, b) => b.length - a.length)[0];
  if (head.length <= 4) return head;
  return head.slice(0, Math.max(4, head.length - 3));
}

function countMatches(tokens: string[], st: string): number {
  if (!st) return 0;
  let n = 0;
  for (const t of tokens) if (t.length >= st.length && t.startsWith(st)) n += 1;
  return n;
}

async function main() {
  const journeys = await prisma.journey.findMany({
    where: { status: { notIn: ["archived"] } },
    select: {
      name: true, language: true, variant: true, status: true, topics: true,
      storiesPerTopic: true,
      stories: { select: { topic: true, slotIndex: true, level: true, slug: true, text: true, vocab: true, status: true } },
    },
  });

  const rows: Array<Record<string, string | number>> = [];
  let gTotal = 0, gOrphan = 0, gSelfOnce = 0;

  for (const j of journeys) {
    const per = Math.max(1, j.storiesPerTopic || 1);
    const order = (topic: string) => {
      const i = j.topics.indexOf(topic);
      return i < 0 ? 999 : i;
    };
    const stories = j.stories
      .filter((s) => (s.text ?? "").length > 0)
      .map((s) => ({ ...s, pos: order(s.topic) * per + (s.slotIndex ?? 0), tokens: tok(s.text ?? "") }))
      .sort((a, b) => a.pos - b.pos);
    if (!stories.length) continue;

    let total = 0, orphan = 0, selfOnce = 0, laterSum = 0;
    const examples: string[] = [];

    for (const s of stories) {
      const vocab = Array.isArray(s.vocab) ? (s.vocab as Array<Record<string, unknown>>) : [];
      const later = stories.filter((o) => o.pos > s.pos).flatMap((o) => o.tokens);
      for (const v of vocab) {
        const st = stem(strip(String(v.word ?? "")));
        if (!st) continue;
        total += 1;
        const self = countMatches(s.tokens, st);
        const after = countMatches(later, st);
        laterSum += after;
        if (self <= 1) selfOnce += 1;
        if (after === 0) {
          orphan += 1;
          if (examples.length < 6) examples.push(String(v.word ?? ""));
        }
      }
    }
    gTotal += total; gOrphan += orphan; gSelfOnce += selfOnce;
    const lvl = stories[0]?.level ?? "?";
    rows.push({
      journey: `${j.name} ${String(j.language).slice(0, 2).toUpperCase()}/${j.variant} ${lvl}`,
      st: j.status, n: stories.length, vocab: total,
      sinReencuentro: total ? `${orphan} (${Math.round((orphan / total) * 100)}%)` : "-",
      soloUnaVezEnSuTexto: total ? `${Math.round((selfOnce / total) * 100)}%` : "-",
      mediaPosteriores: total ? (laterSum / total).toFixed(1) : "-",
      ejemplos: examples.slice(0, 4).join(", "),
    });
  }

  rows.sort((a, b) => String(a.journey).localeCompare(String(b.journey)));
  for (const r of rows) {
    console.log(
      `${String(r.journey).padEnd(34)} ${String(r.st).padEnd(7)} hist ${String(r.n).padStart(2)}  vocab ${String(r.vocab).padStart(4)}  sin reencuentro ${String(r.sinReencuentro).padStart(11)}  1 sola vez en su texto ${String(r.soloUnaVezEnSuTexto).padStart(4)}  media post ${String(r.mediaPosteriores).padStart(4)}`
    );
    if (r.ejemplos) console.log(`    ej: ${r.ejemplos}`);
  }
  console.log(
    `\nTOTAL ${gTotal} entradas · ${gOrphan} (${Math.round((gOrphan / gTotal) * 100)}%) no vuelven a aparecer en su propio journey · ${gSelfOnce} (${Math.round((gSelfOnce / gTotal) * 100)}%) aparecen una sola vez en la historia que las ensena`
  );
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
