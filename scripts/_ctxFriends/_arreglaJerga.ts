/** Arregla la definicion BASE de seis claves de jerga de spanish-friends.
 *
 *  La regla que las une: la definicion tiene que cubrir el uso REAL de sus
 *  historias. Cuando no lo hace, la tarjeta se contradice sola, porque debajo
 *  de la definicion el lector ve la frase traducida: «perdis» decia "you lose"
 *  encima de "At least".
 *
 *  Las filas de historia llevan el sentido que se usa AHI, que es lo que ve el
 *  lector; la fila global lleva la union, que es el diccionario del bundle.
 *  Por eso «choro» sale como sustantivo en una historia y como adjetivo en la
 *  otra: son dos palabras distintas que se escriben igual. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-friends";
const p = new PrismaClient();

type Def = { g: string; t: string };
/** clave → { global, porHistoria } */
const ARREGLOS: Record<string, { global: Def; porHistoria: Record<string, Def> }> = {
  // g: "you lose". Solo sale en "De perdis", que es "al menos" en mexicano.
  perdis: {
    global: { g: "at least, in the phrase de perdis", t: "expression" },
    porHistoria: { "diez-intentos": { g: "at least, in the phrase de perdis", t: "expression" } },
  },
  // g: "thief; cool, tough", dos sentidos chilenos. "Ladron" no sale en el
  // bundle; los usos son "echar choro" (soltar un rollo) y "bien choro" (cool).
  choro: {
    global: { g: "a long-winded spiel, in echar choro; also great, cool", t: "noun" },
    porHistoria: {
      "le-toca-a-mateo": { g: "a long-winded spiel, in echar choro", t: "noun" },
      "todo-es-weon": { g: "great, cool", t: "adjective" },
    },
  },
  // g: "to weigh; grief". El unico uso es "A pesar de que", que no es ninguno
  // de los dos.
  pesar: {
    global: { g: "despite, in the phrase a pesar de", t: "expression" },
    porHistoria: { "todo-es-weon": { g: "despite, in the phrase a pesar de", t: "expression" } },
  },
  // g: "spaced out; whim (Mex.)". El unico uso es "de volada", que es "en el
  // acto".
  volada: {
    global: { g: "straight away, in the phrase de volada", t: "expression" },
    porHistoria: { "rodrigo-se-lo-busco": { g: "straight away, in the phrase de volada", t: "expression" } },
  },
  // g: "balls; no way". El uso es "como las pelotas", que en Chile es que algo
  // quedo pesimo, no una negativa.
  pelotas: {
    global: { g: "awful, in the phrase como las pelotas", t: "expression" },
    porHistoria: { "todo-es-weon": { g: "awful, in the phrase como las pelotas", t: "expression" } },
  },
  // g: "name; no way". El "no way" es la interjeccion mexicana, y aqui la
  // palabra sale una sola vez como sustantivo llano en una historia chilena.
  nombre: {
    global: { g: "name", t: "noun" },
    porHistoria: { "todo-es-weon": { g: "name", t: "noun" } },
  },
};

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  for (const f of filas) {
    const g = f.glosses as Record<string, Record<string, unknown>>;
    let tocada = false;
    for (const [w, a] of Object.entries(ARREGLOS)) {
      const def = f.slug ? a.porHistoria[f.slug] : a.global;
      if (!def || !g[w]) continue;
      console.log(`${f.slug || "(global)"} · ${w}\n  antes: ${JSON.stringify({ g: g[w].g, t: g[w].t })}\n  ahora: ${JSON.stringify(def)}`);
      g[w] = { ...g[w], ...def };
      tocada = true;
    }
    if (!tocada) continue;
    await p.tapGlossSet.update({
      where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g as never },
    });
  }
  await p.$disconnect();
})();
