/** Compone la escena de una portada: REPARTO FIJO del tema + lo que cambia en
 *  esta historia + la coletilla comun. Deja el archivo listo para el generador
 *  sancionado de portadas.
 *
 *  WHY (2026-09-03): la regla de portadas dice que el prompt se cierra ANTES de
 *  la primera tirada. Yo lo reescribia entero en cada una y por eso Leandro
 *  cambio de camisa cobalto a camiseta entre la primera y la segunda, y en la
 *  tercera Flux dibujo dos veces a Marisol. Ademas iba anadiendo un bloque de
 *  prohibiciones por cada defecto, y ese amontonamiento de negaciones acabo
 *  disparando la moderacion de Flux ("request moderated"), que gasto un
 *  disparador sin devolver imagen.
 *
 *  Por eso: el reparto es literal e inmutable (scripts/_a2/reparto/<tema>.txt),
 *  la escena solo dice sitio, accion y objetos, y las restricciones van una
 *  sola vez, en positivo, al final.
 *
 *  uso:  npx tsx scripts/_a2Escena.ts <slug>   -> scripts/_a2/<slug>.prompt.txt
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const DIR = path.join(__dirname, "_a2");

// Una sola vez, en positivo. Nada de listas de "no esto, no lo otro": Flux
// pondera mal las negaciones y amontonadas disparan su moderador.
const COMUN = `Broad clean daylight, bright and cheerful, vivid saturated colour, rich and never muddy.

Every face has one uniform clean skin tone, the cheeks exactly the same flat tone as the forehead and the chin.

16:9, both figures at mid distance, three-quarter view so both faces are visible. Every surface in the picture is plain: paper, walls and packaging are blank, and the whole image is free of any writing.`;

(async () => {
  const slug = process.argv[2];
  const s = await p.journeyStory.findFirst({
    where: { slug },
    select: { id: true, topic: true, title: true },
  });
  if (!s) throw new Error(`no encuentro ${slug}`);
  const reparto = path.join(DIR, "reparto", `${s.topic}.txt`);
  const escena = path.join(DIR, "escenas", `${slug}.txt`);
  for (const f of [reparto, escena]) if (!fs.existsSync(f)) throw new Error(`falta ${f}`);
  const out = path.join(DIR, `${slug}.prompt.txt`);
  fs.writeFileSync(
    out,
    [fs.readFileSync(escena, "utf8").trim(), fs.readFileSync(reparto, "utf8").trim(), COMUN].join("\n\n") + "\n"
  );
  console.log(`${s.title} [${s.topic}] · id ${s.id}\n${out}`);
  await p.$disconnect();
})();
