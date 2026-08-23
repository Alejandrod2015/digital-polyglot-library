/**
 * Escalera de recirculación dentro de UN journey, historia a historia.
 *
 * Por cada palabra enseñada dice cuántos encuentros tiene y dónde:
 *   1 = el slot que la enseña   2 = otra vez en su propia historia
 *   3+ = apariciones en historias POSTERIORES (orden de lectura)
 *
 * Emparejamiento por raíz recortando hasta 3 caracteres, igual que
 * `_vocabIntraJourney.ts`, así que SOBREESTIMA. Solo lectura.
 *
 *   npx tsx scripts/_vocabLadderFR.ts <journeyId>
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";

const p = new PrismaClient();
const tok = (s: string) => (s.toLowerCase().match(/\p{L}+/gu) ?? []);
const strip = (w: string) => w.replace(/^(le|la|les|l'|un|une|des|du|de)\s+/i, "").trim();
/** Quita el plural francés antes de recortar: sin esto "clé" no casa con
 *  "clés" (4 letras, por debajo del recorte) y la palabra sale como huérfana
 *  estando dos veces en la misma página. */
const depl = (w: string) => (w.length > 3 && /(?:es|s|x)$/.test(w) ? w.replace(/(?:es|s|x)$/, "") : w);
function stemWord(w: string): string {
  const d = depl(w);
  return d.length <= 4 ? d : d.slice(0, Math.max(4, d.length - 3));
}
function stem(w: string): string {
  const t = tok(strip(w));
  if (!t.length) return "";
  const head = [...t].sort((a, b) => b.length - a.length)[0];
  return stemWord(head);
}

async function main() {
  const journeyId = process.argv[2];
  const j = await p.journey.findUnique({ where: { id: journeyId }, select: { topics: true } });
  const order = j?.topics ?? [];
  // `--file <json>` mide un lote antes de guardarlo, con el mismo criterio que
  // la base: sin esto, comparar "antes y despues" mezcla medidores.
  const fileArg = process.argv.indexOf("--file");
  const st = (fileArg > 0
    ? JSON.parse(fs.readFileSync(process.argv[fileArg + 1], "utf8"))
    : await p.journeyStory.findMany({
        where: { journeyId, NOT: { text: null } },
        select: { topic: true, slotIndex: true, title: true, text: true, vocab: true },
      })
  ).sort((a: any, b: any) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  // Emparejar por PREFIJO común y no por raíz recortada a ciegas: "descendre"
  // recorta a "descen" y "descends" a "desc", que como cadenas no son iguales
  // aunque sean la misma palabra. Cuatro caracteres es el mínimo para no casar
  // "porte" con "portable".
  const stems = st.map((s: any) => tok(String(s.text)).map(depl));
  // Prefijo COMÚN de al menos 4, no prefijo de la más corta: "pleuvoir" y
  // "pleut" comparten "pleu" y son la misma palabra, pero exigir que una sea
  // prefijo de la otra las separa. Sobreestima ("porte" casa con "portable"),
  // así que el porcentaje que sale es el suelo del problema, no el techo.
  const casa = (a: string, b: string) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i >= 4;
  };
  let solo = 0, total = 0;
  st.forEach((s: any, i: number) => {
    const items = (s.vocab as Array<{ word: string; type: string }>) ?? [];
    const huerfanas: string[] = [];
    let conEscalera = 0;
    for (const v of items) {
      total++;
      const k = depl(tok(strip(v.word)).sort((a, b) => b.length - a.length)[0] ?? "");
      const enSuTexto = stems[i].filter((x) => casa(x, k)).length;
      const despues = stems.slice(i + 1).map((arr, n) => (arr.some((x) => casa(x, k)) ? i + 1 + n + 1 : 0)).filter(Boolean);
      const encuentros = enSuTexto + despues.length;
      // El reencuentro que cuenta es el de OTRA historia. Repetir la palabra
      // dentro de la misma pagina, con la glosa aun a la vista, es
      // reconocimiento inmediato, no recuerdo con esfuerzo: sumarlo al mismo
      // marcador deja maquillar la cifra por el camino barato.
      if (despues.length === 0) { solo++; huerfanas.push(v.word); } else conEscalera++;
      void encuentros;
    }
    console.log(`\n[${i + 1}] ${s.title}  ${items.length} slots · con reencuentro ${conEscalera} · sin ${huerfanas.length}`);
    console.log("   sin reencuentro: " + huerfanas.join(", "));
  });
  console.log(`\nTOTAL ${total} slots · ${solo} sin reencuentro EN OTRA HISTORIA (${Math.round((solo / total) * 100)}%)`);
  await p.$disconnect();
}
main();
