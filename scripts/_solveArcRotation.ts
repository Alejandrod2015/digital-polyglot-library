/**
 * Busca la secuencia de arcTypes VÁLIDA que menos historias obliga a cambiar.
 *
 * La regla del validador: un arco no-comfort no puede repetirse en las 3
 * historias anteriores; los comfort (harmonic-close, daily-encounter) admiten
 * como mucho 2 seguidos. Cambiar la etiqueta sin tocar la historia sería
 * hacerle trampa al gate, así que esto NO decide etiquetas: decide QUÉ
 * historias hay que reescribir de verdad, y a qué forma de cierre.
 */
import * as fs from "fs";

const ARCS = [
  "reframe-turn", "juxtaposition-discovery", "harmonic-close",
  "mini-cliffhanger", "recurring-character-callback", "late-reveal",
  "daily-encounter",
];
const COMFORT = new Set(["daily-encounter", "harmonic-close"]);

type Story = { slug: string; topic: string; slotIndex: number; arcType: string };
const stories: Story[] = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
  .map((s: Story) => ({ slug: s.slug, topic: s.topic, slotIndex: s.slotIndex, arcType: s.arcType }));

// Arcos que cierran: el slot 2 de cada hilo tiene que aterrizar. Sin esto la
// solución de menos cambios deja hilos de tres historias que acaban en un
// descubrimiento a medias, que pasa el gate y deja al lector colgado.
const LANDING = new Set(["harmonic-close", "late-reveal", "recurring-character-callback"]);

function valid(seq: string[], i: number): boolean {
  const arc = seq[i];
  if (stories[i].slotIndex === 2 && !LANDING.has(arc)) return false;
  const recent = seq.slice(Math.max(0, i - 3), i);
  if (COMFORT.has(arc)) return recent.filter((a) => COMFORT.has(a)).length < 2;
  return !recent.includes(arc);
}

const original = stories.map((s) => s.arcType);
let best: { seq: string[]; changes: number } | null = null;

// Búsqueda en profundidad con poda: recorre en orden y prioriza conservar el
// arco original de cada historia, así la primera solución completa ya es la de
// menos cambios para ese prefijo.
function search(i: number, seq: string[], changes: number) {
  if (best && changes >= best.changes) return;
  if (i === stories.length) {
    best = { seq: [...seq], changes };
    return;
  }
  const candidates = [original[i], ...ARCS.filter((a) => a !== original[i])];
  for (const arc of candidates) {
    seq.push(arc);
    if (valid(seq, i)) search(i + 1, seq, changes + (arc === original[i] ? 0 : 1));
    seq.pop();
  }
}
search(0, [], 0);

if (!best) { console.log("sin solución"); process.exit(1); }
const solution = best as { seq: string[]; changes: number };
console.log(`cambios mínimos necesarios: ${solution.changes} de ${stories.length}\n`);
stories.forEach((s, i) => {
  const to = solution.seq[i];
  const mark = to === original[i] ? "     " : "  →  REESCRIBIR";
  console.log(`${String(i + 1).padStart(2)}. ${s.topic}/${s.slotIndex} ${s.slug.padEnd(28)} ${original[i].padEnd(28)}${mark}${to === original[i] ? "" : " " + to}`);
});
