/**
 * SOLO LECTURA. Las glosas COPIADAS de otro bundle (rev:false) del A2 PT, cada
 * una junto a la frase de ESTE journey donde cae.
 *
 * Una glosa copiada trae el sentido del journey de origen, y ese sentido no
 * tiene por que ser el de aqui: es el defecto que dejo 14 glosas muertas en el
 * italiano. Esto no decide nada; pone la glosa y su frase una al lado de la
 * otra para poder leerlas.
 *
 *   npx tsx scripts/_pta2RevGlosas.ts [--todas]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const BUNDLE = "portuguese-traveler-brazil-a2";
const J = "cmtrcpgso00073232h8vaf7na";
const p = new PrismaClient();

/** Palabras cuyo sentido NO depende del contexto: no hace falta leerlas. */
const FUNCION = new Set(
  ("de do da dos das em no na nos nas por para com sem que se e ou mas ja nao sim ao aos pelo pela " +
   "eu tu voce ele ela nos vocês eles elas meu teu seu sua dele dela isso isto aqui ali la quando " +
   "onde como quem qual mais menos muito pouco tudo todo toda todos todas cada outro outra tambem " +
   "so ate depois antes entao porque ainda assim agora nada quanto mesmo bem entre e é são foi era").split(" "),
);

(async () => {
  const todas = process.argv.includes("--todas");
  const fila = await p.tapGlossSet.findFirst({ where: { bundle: BUNDLE, slug: "" }, select: { glosses: true } });
  const g = (fila?.glosses ?? {}) as Record<string, { g: string; t?: string; rev?: boolean }>;
  const historias = await p.journeyStory.findMany({
    where: { journeyId: J, NOT: { text: null } },
    select: { slug: true, text: true },
  });

  /** La primera oracion de este journey donde sale la palabra. */
  const frase = (w: string): string | null => {
    const re = new RegExp(`(?<!\\p{L})${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu");
    for (const s of historias)
      for (const o of String(s.text).split(/(?<=[.!?…”])\s+|\n+/))
        if (re.test(o)) return o.trim();
    return null;
  };

  const copiadas = Object.entries(g).filter(([, v]) => v?.rev === false);
  let mostradas = 0;
  for (const [w, v] of copiadas.sort(([a], [b]) => a.localeCompare(b))) {
    if (!todas && FUNCION.has(w.toLowerCase())) continue;
    const f = frase(w);
    if (!f) continue; // esta en el mapa pero no en el texto de este journey
    mostradas++;
    console.log(`${w}  ->  ${v.g}  [${v.t ?? "?"}]`);
    console.log(`    ${f}`);
  }
  console.log(`\n${copiadas.length} copiadas en total · ${mostradas} de contenido, con su frase de este journey`);
})().finally(() => p.$disconnect());
