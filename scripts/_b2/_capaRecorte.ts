/** Los trozos de contexto de las glosas que citaban frases quitadas en el
 *  recorte a 150-166 palabras de los temas 1-4 (2026-09-11). Cada trozo nuevo
 *  se comprueba contra el texto de la base antes de escribir; solo cambia `c`. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
const J = "cmtpls1l20007j8epwgcs6e1h";
type F = [string, string[], string, string];
const FIX: F[] = [
  ["el-chiste-tan-suyo", ["trampa"], "ella notó la trampa", "she noticed the trick"],
  ["el-chiste-tan-suyo", ["silbido"], "desde la puerta, un silbido", "from the door, a whistle"],
  ["el-chiste-tan-suyo", ["rendirse", "se rindió"], "y se rindió", "and gave up"],
  ["de-pura-muina", ["jícama"], "mientras ella rebanaba jícama", "while she sliced jicama"],
  ["la-once-con-chirrido", ["a pie"], "y bajó a pie", "and went down on foot"],
  ["la-once-con-chirrido", ["mantención"], "Por la rejilla se veía la mantención", "through the grate the upkeep showed"],
  ["yo-no-fallo", ["encargo"], "tenía un solo encargo", "had a single order"],
  ["la-licitacion-desierta", ["postular"], "¿Y vas a postular?", "are you going to apply"],
  ["la-licitacion-desierta", ["postulé"], "Ya postulé", "I already applied"],
  ["la-licitacion-desierta", ["licitación"], "la licitación de la estación", "the tender for the station"],
  ["la-licitacion-desierta", ["quedar fuera", "quedó fuera"], "Quedó fuera igual", "she was left out anyway"],
  ["la-cortesia-mas-cara", ["muestrario"], "cruzó la ciudad con el muestrario", "crossed the city with the sample book"],
  ["buena-suerte-en-porteno", ["al pasar"], "en el recreo, al pasar", "at break, in passing"],
  ["buena-suerte-en-porteno", ["estampilla", "estampillas"], "con estampillas", "with stamps"],
  ["una-yapa-de-sobremesa", ["mozo"], "El mozo trajo el chaufa", "the waiter brought the fried rice"],
  ["una-yapa-de-sobremesa", ["lapicero"], "con su lapicero", "with her pen"],
  ["la-otra-columna", ["subte"], "bajaba del subte", "got off the subway"],
  ["la-otra-columna", ["adelante"], "Los de la aplicación van adelante", "the app group is ahead"],
  ["tres-veces-por-escrito", ["salto"], "dio un salto", "gave a jolt"],
  ["tres-veces-por-escrito", ["crujir", "crujió"], "dio un salto, crujió", "jolted, creaked"],
  ["tres-veces-por-escrito", ["sería"], "¿Cuánto sería un ratito?", "how long would a little while be"],
  ["tres-veces-por-escrito", ["repuesto"], "pedían el repuesto", "asked for the spare part"],
  ["tres-veces-por-escrito", ["temblón", "temblonas"], "con piernas temblonas", "on shaky legs"],
];
(async () => {
  const p = new PrismaClient();
  const textos = new Map((await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, text: true } })).map((s) => [s.slug, s.text.toLowerCase()]));
  const filas = new Map<string, Record<string, any>>();
  let n = 0;
  for (const [slug, claves, es, en] of FIX) {
    if (!textos.get(slug)?.includes(es.toLowerCase())) throw new Error(`${slug}: el trozo no esta en el texto: ${es}`);
    if (!filas.has(slug)) {
      const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
      filas.set(slug, { ...(f!.glosses as Record<string, any>) });
    }
    const g = filas.get(slug)!;
    for (const k of claves) { if (!g[k]) throw new Error(`${slug}: sin clave ${k}`); g[k] = { ...g[k], c: { es, en } }; n++; }
  }
  const muina = filas.get("de-pura-muina")!;
  if (!textos.get("de-pura-muina")!.includes("pidió que no se lo contara")) throw new Error("contara no esta");
  muina["contara"] = { ...muina["contaran"], g: "would tell (subjunctive of contar)", c: { es: "pidió que no se lo contara", en: "she asked him not to tell" } };
  delete muina["contaran"]; n++;
  for (const [slug, g] of filas) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
  console.log(`claves con trozo nuevo: ${n} en ${filas.size} historias`);
  await p.$disconnect();
})();
