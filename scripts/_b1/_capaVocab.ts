/** Las 19 plazas que el vocab tenia sin capa: expresiones de varias palabras
 *  (la capa iba por palabra suelta) y verbos guardados por lema. Se escriben en
 *  la fila de la historia con la clave que busca el panel: el lema Y la
 *  superficie. Trozo minimo con sentido, tope de 8 palabras, como la glosa. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "celia-no-dice-que-si": [
    { claves: ["mudarse", "se ha mudado"], t: "verb", g: "has moved (mudarse)", es: "se ha mudado a Granada", en: "has moved to Granada" },
    { claves: ["comprobar", "ha comprobado"], t: "verb", g: "has checked (comprobar)", es: "ha comprobado el armario", en: "has checked the wardrobe" },
    { claves: ["de mes en mes"], t: "expression", g: "month by month", es: "el alquiler es de mes en mes", en: "the rent runs month by month" },
    { claves: ["por adelantado"], t: "expression", g: "in advance", es: "el primero por adelantado", en: "the first one in advance" },
    { claves: ["de todo"], t: "expression", g: "all sorts", es: "arriba se oye de todo", en: "upstairs you hear all sorts" },
    { claves: ["a la primera"], t: "expression", g: "first time", es: "no cierra a la primera", en: "does not shut first time" },
    { claves: ["sin decir nada"], t: "expression", g: "without a word", es: "baja los cuatro pisos sin decir nada", en: "goes down the four floors without a word" },
  ],
  "la-mayoria-decide-el-techo": [
    { claves: ["en voz alta"], t: "expression", g: "out loud", es: "lo revisa todo en voz alta", en: "goes through it all out loud" },
    { claves: ["de una vez"], t: "expression", g: "at once, once and for all", es: "firmar los tres y de una vez", en: "the three of them signing, at once" },
    { claves: ["por su cuenta"], t: "expression", g: "on their own", es: "ni de Emilio por su cuenta", en: "nor on Emilio on his own" },
    { claves: ["al final"], t: "expression", g: "in the end", es: "al final llega el sello", en: "in the end the stamp arrives" },
    { claves: ["poco más"], t: "expression", g: "little else", es: "el techo y poco más", en: "the roof and little else" },
  ],
  "arriba-vive-alguien": [
    { claves: ["colgar", "ha colgado"], t: "verb", g: "has hung (colgar)", es: "ha colgado tres perchas", en: "has hung three hangers" },
    { claves: ["pegar", "ha pegado"], t: "verb", g: "has stuck (pegar)", es: "ha pegado una hoja en la puerta", en: "has stuck a sheet on the door" },
    { claves: ["poco a poco"], t: "expression", g: "little by little", es: "la lee entera, poco a poco", en: "reads it right through, little by little" },
    { claves: ["en serio"], t: "expression", g: "seriously", es: "haría falta permiso de todos, en serio", en: "it would take everyone's permission, seriously" },
    { claves: ["sin falta"], t: "expression", g: "without fail", es: "aunque me lo devuelva sin falta", en: "as long as it comes back without fail" },
    { claves: ["de golpe"], t: "expression", g: "all at once", es: "alguien ha arrastrado algo arriba, de golpe", en: "somebody has dragged something upstairs, all at once" },
    { claves: ["de momento"], t: "expression", g: "for now", es: "de momento apunta la hora", en: "for now she notes the time" },
  ],
};
(async () => {
  const p = new PrismaClient();
  let escritas = 0;
  for (const [slug, entradas] of Object.entries(CAPA)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...((fila?.glosses ?? {}) as Record<string, any>) };
    for (const e of entradas) {
      if (e.es.split(/\s+/).length > 8) throw new Error(`trozo de mas de 8 palabras: ${e.es}`);
      for (const k of e.claves) { g[k] = { g: e.g, t: e.t, c: { es: e.es, en: e.en }, rev: true }; escritas++; }
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  console.log(`claves escritas ${escritas}`);
  await p.$disconnect();
})();
