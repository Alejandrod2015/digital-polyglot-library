/** Mide los candidatos de titulo contra lo que el validador comprueba: tope de
 *  caracteres, caracteres prohibidos, y solape de tokens con los titulos que ya
 *  existen en el journey (mas del 50% lo tumba). Contar a ojo es justo el
 *  pecado de una de estas historias. Solo lee.
 *
 *  Los caracteres prohibidos van por punto de codigo, nunca literales: el guard
 *  de guiones largos bloquea el caracter en todo el repo y tiene razon aunque
 *  esto sea un detector. 00AB/00BB son las angulares, 2014 y 2013 los guiones,
 *  0022 la comilla recta. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const JOURNEY = "cmtmylg7k0007321h6t7njesx";
const TOPE = 26;
const PROHIBIDOS = new RegExp("[\\u00AB\\u00BB\\u2014\\u2013\\u0022]");

const CANDIDATOS: Record<string, string[]> = {
  "le-puso-el-ojo-al-cuartel": ["Cuatro hileras sin podar", "Calculó con el ojo", "El hombro que no contó"],
  "la-pasilla-del-jueves": ["Escuchó solo la mitad", "Subió el precio el jueves", "Mezcló para que durara"],
  "prometio-cargar-el-anda": ["La tabla quedó delgada", "Lijó tres veces la tabla", "Lo apuntaron en la lista"],
  "le-fiaron-en-el-palenque": ["Dobló el boleto en cuatro", "Dijo que él no jugaba", "Faltaban doscientos"],
};

const VACIAS = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "al", "a", "en", "y", "que", "no", "se", "lo", "le", "con", "para", "por"]);
const tokens = (s: string) =>
  new Set((s.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => !VACIAS.has(w)));

(async () => {
  const hs = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY }, select: { slug: true, title: true },
  });
  const otros = hs.filter((h) => !Object.keys(CANDIDATOS).includes(h.slug ?? ""));

  for (const [slug, lista] of Object.entries(CANDIDATOS)) {
    console.log(`\n${slug}`);
    for (const t of lista) {
      const problemas: string[] = [];
      if (t.length > TOPE) problemas.push(`${t.length} caracteres, tope ${TOPE}`);
      if (PROHIBIDOS.test(t)) problemas.push("caracter prohibido");
      const mios = tokens(t);
      for (const o of otros) {
        const suyos = tokens(o.title ?? "");
        const comunes = [...mios].filter((w) => suyos.has(w));
        if (mios.size && comunes.length / mios.size > 0.5) {
          problemas.push(`solapa con ${o.title} (${comunes.join(", ")})`);
        }
      }
      console.log(`  ${problemas.length ? "MAL" : "ok "}  ${String(t.length).padStart(2)}  ${t}${problemas.length ? `\n         ${problemas.join(" y ")}` : ""}`);
    }
  }
  await p.$disconnect();
})();
