/** Capa de las 5 plazas nuevas del arbitraje + las 14 sin fuente tras e46c2a95. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b1";
type E = { c: { es: string; en: string }; g: string; t: string };
const PLAN: Record<string, Record<string, E>> = {
  "el-techo-de-los-tres": { "portátil": { c: { es: "baja con el portátil", en: "comes down with the laptop" }, g: "laptop, portable computer (el portátil)", t: "noun" } },
  "el-tejado-a-la-mitad": {
    "salir las cuentas": { c: { es: "no le salen las cuentas", en: "the numbers do not add up" }, g: "to add up, to make sense", t: "expression" },
    "apoyarse": { c: { es: "se apoya en el coche", en: "leans on the car" }, g: "to lean on (apoyarse)", t: "verb" },
  },
  "el-piloto-azul": {
    "misterio": { c: { es: "no tiene mucho más misterio", en: "has no great mystery to it" }, g: "mystery (el misterio)", t: "noun" },
    "girarse": { c: { es: "Quique se gira", en: "Quique turns around" }, g: "to turn around (girarse)", t: "verb" },
  },
  "mira-la-apuntadora": {
    "buzón": { c: { es: "está en el buzón", en: "is by the letterbox" }, g: "letterbox of the building (el buzón)", t: "noun" },
    "pararse": { c: { es: "se para en el escalón", en: "stops on the step" }, g: "to stop, to come to a halt (pararse)", t: "verb" },
  },
  "un-favor-sin-pedir": { "tal cual": { c: { es: "tal cual la ha oído", en: "just as she heard it" }, g: "just as it is, unchanged", t: "expression" } },
  "la-fecha-que-decide": {
    "cortarse": { c: { es: "la línea se corta", en: "the line cuts out" }, g: "to cut out, to get cut off (cortarse)", t: "verb" },
    "oírse": { c: { es: "se oye la mitad", en: "only half can be heard" }, g: "to be heard (oírse)", t: "verb" },
  },
  "a-ver-si-te-sigo": { "perderse": { c: { es: "se pierde en el segundo", en: "gets lost at the second one" }, g: "to get lost (perderse)", t: "verb" } },
  "lo-de-chispa": { "enterarse": { c: { es: "se enteró hace años", en: "found out years ago" }, g: "to find out (enterarse)", t: "verb" } },
  "lo-pongo-por-escrito": {
    "tocarse": { c: { es: "se toca el cuello", en: "touches his own neck" }, g: "to touch a part of your own body (tocarse)", t: "verb" },
    "encima de": { c: { es: "encima del buzón", en: "on top of the letterbox" }, g: "on top of, resting on", t: "expression" },
  },
  "poco-y-de-oidas": {
    "encogerse": { c: { es: "Se encoge de hombros", en: "shrugs her shoulders" }, g: "to shrug, to hunch up (encogerse)", t: "verb" },
    "acordarse": { c: { es: "se acuerda de junio", en: "remembers June" }, g: "to remember (acordarse)", t: "verb" },
  },
  "palabra-por-palabra": {
    "acabarse": { c: { es: "se me acaba el contrato", en: "my contract runs out" }, g: "to run out, to end (acabarse)", t: "verb" },
    "debajo de": { c: { es: "debajo del estómago", en: "below her stomach" }, g: "under, below", t: "expression" },
  },
  "la-voz-mas-rapida": { "todavía no": { c: { es: "no me voy todavía", en: "I am not leaving yet" }, g: "not yet", t: "expression" } },
};
(async () => {
  for (const [slug, fixes] of Object.entries(PLAN)) {
    const st = await p.journeyStory.findFirst({ where: { slug, journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { text: true, title: true } });
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    if (!st || !fila) throw new Error(`falta ${slug}`);
    const todo = (st.title + "\n" + st.text).toLowerCase();
    const g = { ...(fila.glosses as Record<string, any>) };
    for (const [k, v] of Object.entries(fixes)) {
      if (!todo.includes(v.c.es.toLowerCase())) throw new Error(`${slug}/${k}: "${v.c.es}" no es subcadena`);
      g[k] = { ...(g[k] ?? {}), ...v };
      console.log(`  ${slug} · ${k}`);
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  await p.$disconnect();
})();
