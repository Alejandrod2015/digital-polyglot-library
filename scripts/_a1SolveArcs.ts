/**
 * Secuencia válida de arcTypes para el A1 España.
 *
 * El juego está reducido a propósito: fuera `late-reveal` y
 * `juxtaposition-discovery`, que son formas de revelación y de choque de dos
 * elementos, y el A1 no lleva giro. Quedan cinco, dos de ellos comfort.
 *
 * Reglas del validador: un arco no-comfort no puede repetirse en las 3
 * anteriores; los comfort admiten 2 seguidos como mucho. Añadido: el slot 2 de
 * cada hilo tiene que aterrizar.
 */
// Orden de preferencia, no alfabético: el solver coge el primero que encaja,
// así que la lista ES la política de reparto. `daily-encounter` va el último
// porque la spec lo quiere al 5% y es el default que se sobreusa.
const ARCS = ["reframe-turn", "mini-cliffhanger", "recurring-character-callback", "harmonic-close", "daily-encounter"];
const COMFORT = new Set(["daily-encounter", "harmonic-close"]);
const LANDING = new Set(["harmonic-close", "recurring-character-callback"]);

const TOPICS = ["los-vecinos", "el-bar", "la-compra", "el-reloj", "la-casa", "el-medico-y-la-farmacia", "la-fiesta-del-pueblo"];
const slots = TOPICS.flatMap((t) => [0, 1, 2].map((i) => ({ topic: t, slot: i })));

// Arcos que NO pueden abrir un hilo: uno que cierra en calma no puede ser la
// primera historia de tres, y un callback en el slot 0 no tiene a qué volver.
const NO_OPENING = new Set(["harmonic-close", "recurring-character-callback"]);

function valid(seq: string[], i: number): boolean {
  const arc = seq[i];
  if (slots[i].slot === 2 && !LANDING.has(arc)) return false;
  if (slots[i].slot === 0 && NO_OPENING.has(arc)) return false;
  const recent = seq.slice(Math.max(0, i - 3), i);
  if (COMFORT.has(arc)) return recent.filter((a) => COMFORT.has(a)).length < 2;
  return !recent.includes(arc);
}

const out: string[] = [];
function search(i: number): boolean {
  if (i === slots.length) return true;
  for (const arc of ARCS) {
    out.push(arc);
    if (valid(out, i) && search(i + 1)) return true;
    out.pop();
  }
  return false;
}

if (!search(0)) {
  console.log("no hay secuencia válida con este juego de arcos");
  process.exit(1);
}
const counts = new Map<string, number>();
slots.forEach((s, i) => {
  counts.set(out[i], (counts.get(out[i]) ?? 0) + 1);
  console.log(`${String(i + 1).padStart(2)}. ${s.topic}/${s.slot}  ${out[i]}`);
});
console.log("\nreparto:", [...counts].map(([a, n]) => `${a}=${n}`).join(" · "));
