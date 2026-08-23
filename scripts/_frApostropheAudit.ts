/** ¿Qué le pasa al paquete de glosas francés con los apóstrofos?
 *  Mide, sobre los cuerpos reales, cuántos tokens con apóstrofo resuelven a
 *  algo útil con la cascada que propone la otra sesión (entero -> lo de detrás
 *  -> lo de delante) y cuáles se quedan sin glosa. Solo lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const BUNDLE = "src/data/tapGlosses/french-expat-lyon.json";
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu" }, select: { text: true, title: true } });
  const raw = JSON.parse(fs.readFileSync(BUNDLE, "utf8"));
  const glosas: Record<string, string> = raw.glosses ?? raw;
  const tiene = (k: string) => Object.prototype.hasOwnProperty.call(glosas, k.toLowerCase());

  const cuerpos = st.map((s) => `${s.title ?? ""}\n${s.text ?? ""}`).join("\n");
  const conApostrofo = [...new Set((cuerpos.normalize("NFC").replace(/’/g, "'").toLowerCase()
    .match(/\p{L}+'\p{L}+/gu) ?? []))].sort();

  let ok = 0; const faltan: string[] = []; const soloEntero: string[] = [];
  for (const t of conApostrofo) {
    const [antes, detras] = [t.split("'")[0], t.split("'").slice(1).join("'")];
    if (tiene(t)) { ok++; soloEntero.push(t); continue; }
    if (tiene(detras)) { ok++; continue; }
    if (tiene(antes)) { faltan.push(`${t} (solo resuelve por "${antes}", que no es la palabra)`); continue; }
    faltan.push(`${t} (sin glosa por ningun lado)`);
  }
  console.log(`tokens distintos con apostrofo: ${conApostrofo.length}`);
  console.log(`resuelven bien: ${ok} · mal o sin glosa: ${faltan.length}`);
  console.log(`guardados como clave ENTERA (${soloEntero.length}): ${soloEntero.join(", ")}`);
  if (faltan.length) console.log("PROBLEMA:\n  " + faltan.join("\n  "));
  await p.$disconnect();
})();
