/** Los trozos de contexto de las glosas que citaban frases quitadas en el
 *  recorte de los temas 5-7 (2026-09-11). Cada trozo nuevo
 *  se comprueba contra el texto de la base antes de escribir; solo cambia `c`. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
const J = "cmtpls1l20007j8epwgcs6e1h";
type F = [string, string[], string, string];
const FIX: F[] = [
  ["la-ultima-dorada", ["parada", "parado"], "la probó parada", "tasted it standing up"],
  ["la-ultima-dorada", ["contada", "contado"], "La plata estaba contada", "the money was counted"],
  ["la-ultima-dorada", ["campanita"], "la campanita sonaba", "the little bell rang"],
  ["la-carreta-mojada", ["techado"], "llegó al corredor techado", "reached the covered porch"],
  ["la-carreta-mojada", ["hoja por hoja"], "del papel hoja por hoja", "off the paper page by page"],
  ["el-trasteo-ajeno", ["cita"], "como si el dueño tuviera otra cita", "as if the owner had another appointment"],
  ["el-trasteo-ajeno", ["bomba", "bombas"], "y bombas en la puerta", "and balloons on the door"],
  ["el-trasteo-ajeno", ["arriendo"], "el arriendo en efectivo", "the rent in cash"],
  ["el-trasteo-ajeno", ["decidido"], "Venía decidido", "he came determined"],
  ["el-trasteo-ajeno", ["desocupado"], "desocupado hacía un mes", "empty for a month"],
  ["el-trasteo-ajeno", ["sin pensarlo"], "ya, sin pensarlo", "right now, without thinking"],
  ["aca-los-errores-se-pagan", ["doblado"], "le devolvió el delantal doblado", "handed back the apron folded"],
  ["la-napa-del-dueno", ["aparecer", "apareció"], "ese dueño apareció", "that owner showed up"],
  ["la-napa-del-dueno", ["rebusque"], "tres meses de rebusque", "three months of hustling"],
  ["la-historia-sin-agrandar", ["álbum"], "hojeó el álbum del hospedaje", "leafed through the guesthouse album"],
  ["la-historia-sin-agrandar", ["cargado"], "cargado de pescado", "loaded with fish"],
  ["la-historia-sin-agrandar", ["a plena luz"], "Lo sacó a plena luz", "brought it out in broad daylight"],
  ["de-medio-metro-y-gracias", ["corregir", "corrigió"], "corrigió Ofelia", "Ofelia corrected"],
  ["aqui-se-dice-arrendando", ["a medio camino"], "el vaso a medio camino", "the glass halfway up"],
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
  const napa = filas.get("la-napa-del-dueno")!;
  if (textos.get("la-napa-del-dueno")!.includes("preguntó")) throw new Error("preguntó sigue en el texto");
  delete napa["preguntó"]; n++;
  for (const [slug, g] of filas) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
  console.log(`claves con trozo nuevo: ${n} en ${filas.size} historias`);
  await p.$disconnect();
})();
