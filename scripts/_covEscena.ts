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
 *  ORDEN (2026-09-10): el reparto va PRIMERO. En la unica tirada de
 *  `le-puse-el-ojo` con el reparto al final, Flux dibujo al hombre de 32 anos
 *  como un vinatero canoso de 65 y cambio la ropa de los dos: la edad y el
 *  color de ropa quedaban a 200 palabras del principio, donde ya no pesan.
 *
 *  uso:  npx tsx scripts/_covEscena.ts <carpeta> <slug>
 *        -> scripts/<carpeta>/<slug>.prompt.txt
 *
 *  Generalizado desde _a2Escena.ts el 2026-09-09 para el B1 latam: el molde
 *  es el mismo y duplicarlo habria dejado dos coletillas comunes que se
 *  separan sin que nadie lo note.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const DIR = path.join(__dirname, process.argv[2] ?? "_a2");

// Una sola vez, en positivo. Nada de listas de "no esto, no lo otro": Flux
// pondera mal las negaciones y amontonadas disparan su moderador.
const COMUN = `Broad clean daylight, bright and cheerful, vivid saturated colour, rich and never muddy.

Every face has one uniform clean skin tone, the cheeks exactly the same flat tone as the forehead and the chin.

Same visual register as the published cover of "Tinto en La Candelaria": flat saturated colour, thick clean outline, strong daylight.

16:9, __PLANO__. Every surface in the picture is plain: paper, walls and packaging are blank, and the whole image is free of any writing.`;

// El plano NO es comun: si lo fuera, las 21 portadas de un journey saldrian con
// el mismo encuadre, que es lo que pasaba (dos de pie, media distancia, tres
// cuartos, veintiuna veces). Cada tema reparte tres planos distintos entre sus
// tres historias. (2026-09-10)
const PLANO_POR_DEFECTO =
  "both figures at mid distance, three-quarter view so both faces are visible";
function planoDe(slug: string): string {
  const f = path.join(DIR, "planos.json");
  if (!fs.existsSync(f)) return PLANO_POR_DEFECTO;
  const m = JSON.parse(fs.readFileSync(f, "utf8"));
  return m[slug] || m._default || PLANO_POR_DEFECTO;
}

(async () => {
  const slug = process.argv[3];
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
    [fs.readFileSync(reparto, "utf8").trim(), fs.readFileSync(escena, "utf8").trim(), COMUN.replace("__PLANO__", planoDe(slug))].join("\n\n") + "\n"
  );
  console.log(`${s.title} [${s.topic}] · id ${s.id}\n${out}`);
  await p.$disconnect();
})();
