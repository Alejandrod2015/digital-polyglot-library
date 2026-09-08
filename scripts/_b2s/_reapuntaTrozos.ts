/** Reapunta los trozos c.{es,en} que citaban el titulo viejo; borra los de palabras que ya no son tocables. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
type F = { es: string; en: string } | null;
const PLAN: Record<string, Record<string, F>> = {
  "ya-no-va-a-cerrar-nada": {
    "de": { es: "de eso, de momento", en: "about that, for now" },
    "eso": { es: "de eso, de momento", en: "about that, for now" },
    "ríe": { es: "solo se ríe Marcos", en: "only Marcos laughs" },
  },
  "vuelva-cuando-quiera": {
    "o": { es: "o algo de vivir", en: "or something for living" },
    "de": { es: "algo de vivir", en: "something for living" },
  },
  "una-copla-sin-firma": {
    "copla": { es: "una copla a mano", en: "a song written by hand" },
    "sin": { es: "sin firma", en: "without a signature" },
    "cantar": null,
  },
  "un-mantel-mojado": { "broma": null, "queda": null, "sola": null },
  "me-lo-he-ganado": {
    "su": { es: "en su pared", en: "on its wall" },
    "copla": { es: "hay copla nueva", en: "there is a new song" },
    "con": { es: "con dos clavos", en: "with two nails" },
  },
  "la-persiana-a-media-tarde": {
    "año": { es: "un año entero", en: "a whole year" },
    "que": { es: "lo que le falta", en: "what is missing" },
  },
  "la-herramienta-seria": {
    "lápiz": { es: "guarda el lápiz", en: "keeps the pencil" },
    "fecha": { es: "una fecha se escribe a lápiz", en: "a date is written in pencil" },
  },
  "la-guasa-del-domingo": { "decía": null },
  "la-cuenta-perdida": {
    "ronda": { es: "la primera ronda del viernes", en: "the first round on Friday" },
    "sin": { es: "sin que nadie los pida", en: "without anyone ordering them" },
    "dueño": null,
  },
  "la-cana-de-marcos": {
    "aquí": { es: "aquí a los de la casa", en: "here, for the regulars" },
    "se": { es: "se les apunta", en: "it goes on the slate" },
    "apunta": { es: "se les apunta", en: "it goes on the slate" },
  },
  "la-bolsa-como-prueba": {
    "tomates": { es: "tomates de los buenos", en: "tomatoes, the good ones" },
    "le": { es: "le tiene guardados tomates", en: "has tomatoes saved for her" },
    "habían": null,
    "guardado": null,
  },
  "el-levante-del-jueves": {
    "barco": { es: "la patrona del barco", en: "the boat's skipper" },
    "para": null,
    "peña": null,
  },
  "el-cafe-lo-pones-tu": {
    "peña": { es: "la peña le ha encargado", en: "the club has hired her" },
    "llaves": { es: "dar las llaves", en: "hand over the keys" },
  },
  "azotea-y-paciencia": {
    "levante": { es: "el levante silba", en: "the east wind whistles" },
    "manda": null,
  },
  "amanece-con-poniente": { "última": null, "llave": null },
};
const norm = (s: string) => s.toLowerCase().normalize("NFC");
(async () => {
  for (const [slug, cambios] of Object.entries(PLAN)) {
    const st = await p.journeyStory.findFirst({ where: { slug, journeyId: "cmtplpfum0007j8c6piegwt31" }, select: { text: true, title: true } });
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    if (!st || !fila) throw new Error(`falta ${slug}`);
    const todo = norm(st.title + "\n" + st.text);
    const g = { ...(fila.glosses as Record<string, any>) };
    for (const [w, f] of Object.entries(cambios)) {
      if (f === null) {
        if (todo.match(new RegExp(`(^|[^\\p{L}])${w.toLowerCase()}([^\\p{L}]|$)`, "u"))) throw new Error(`${slug}/${w}: iba a borrarse pero SIGUE tocable`);
        delete g[w];
        console.log(`  ${slug} · ${w}: BORRADO (ya no es tocable)`);
      } else {
        if (!todo.includes(norm(f.es))) throw new Error(`${slug}/${w}: el trozo "${f.es}" no es subcadena de la historia`);
        if (!norm(f.es).includes(w.toLowerCase())) throw new Error(`${slug}/${w}: el trozo no contiene la palabra`);
        g[w] = { ...(g[w] ?? {}), c: { es: f.es, en: f.en } };
        console.log(`  ${slug} · ${w}: -> "${f.es}"`);
      }
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  await p.$disconnect();
})();
