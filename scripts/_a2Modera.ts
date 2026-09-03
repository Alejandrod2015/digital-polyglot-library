/** Que palabras del prompt NUEVO no aparecen en ningun prompt que Flux ya haya
 *  aceptado. Gratis, offline, y sirve para dejar de adivinar.
 *
 *  WHY (2026-09-03): la septima portada del A2 latam se comio siete
 *  disparadores del usuario. Cada vez cambiaba una palabra a ojo, tiraba, y
 *  Flux devolvia "request moderated". La palabra era "sex", en la frase que
 *  distinguia a los dos personajes ("different sex, different clothes"), y la
 *  encontre comparando el prompt fallido contra uno aceptado, palabra por
 *  palabra. Eso es lo que hace este script, y es lo que debi hacer al primer
 *  fallo en vez de al septimo.
 *
 *  El filtro de entrada de Flux es por palabras, no por sentido: una palabra
 *  inocente en su frase basta para que rechace el prompt entero.
 *
 *  uso:  npx tsx scripts/_a2Modera.ts <slug-nuevo> [slug-aceptado ...]
 *        sin la lista, toma como aceptados todos los .prompt.txt de historias
 *        que YA tienen portada en la base.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const DIR = path.join(__dirname, "_a2");
const palabras = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .replace(/[^a-záéíóúüñ\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

(async () => {
  const nuevo = process.argv[2];
  if (!nuevo) throw new Error("falta el slug nuevo");
  const fNuevo = path.join(DIR, `${nuevo}.prompt.txt`);
  if (!fs.existsSync(fNuevo)) throw new Error(`falta ${fNuevo}; compon la escena primero`);

  let aceptados = process.argv.slice(3);
  if (!aceptados.length) {
    const ss = await p.journeyStory.findMany({
      where: { journeyId: "cmtgelq560007j84n3ujx9bpd", coverUrl: { not: null } },
      select: { slug: true },
    });
    // Nunca compararse contra uno mismo: si la historia ya tiene portada, su
    // propio prompt esta en la lista y el informe sale vacio aunque la escena
    // se haya reescrito entera.
    aceptados = ss
      .map((s) => s.slug!)
      .filter((s) => s !== nuevo && fs.existsSync(path.join(DIR, `${s}.prompt.txt`)));
  }
  if (!aceptados.length) throw new Error("no tengo ningun prompt aceptado con el que comparar");

  const vistas = new Set<string>();
  for (const s of aceptados) for (const w of palabras(fs.readFileSync(path.join(DIR, `${s}.prompt.txt`), "utf8"))) vistas.add(w);

  const nuevas = [...palabras(fs.readFileSync(fNuevo, "utf8"))].filter((w) => !vistas.has(w)).sort();
  console.log(`comparado contra ${aceptados.length} prompt(s) aceptado(s): ${aceptados.join(", ")}`);
  if (!nuevas.length) {
    console.log("ninguna palabra nueva: el prompt solo usa vocabulario que Flux ya acepto");
  } else {
    console.log(`${nuevas.length} palabra(s) que Flux no ha aceptado nunca:`);
    console.log("  " + nuevas.join(" "));
    console.log("Cada una es un candidato a moderacion. Si no hace falta, fuera.");
  }
  await p.$disconnect();
})();
