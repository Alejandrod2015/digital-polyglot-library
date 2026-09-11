/** SOLO LECTURA. Mapa palabra -> [nivel del journey:tipo] de todo el vocab de
 *  portugues, e inventario de la lista B1 (portugueseB1.ts): cuantas quedan
 *  libres como plaza ANCLADA (sin nadie que las ensene) y cuantas solo como
 *  PORTABLE (verbo/adjetivo/adverbio/expresion, que se reabre entre niveles).
 *  Excluye el tema que se va a reescribir (env TEMA) para no contarlo como choque. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { PORTUGUESE_B1_LEMMAS } from "../src/lib/cefr/portugueseB1";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
const p = new PrismaClient();
(async () => {
  const J = "cmtrcpgso00073232h8vaf7na", TEMA = process.env.TEMA ?? "";
  const st = await p.journeyStory.findMany({ where: { journey: { language: "portuguese", status: { not: "archived" } } }, select: { vocab: true, topic: true, journeyId: true, journey: { select: { levels: true, name: true } } } });
  const mapa: Record<string, string[]> = {};
  for (const s of st) {
    if (s.journeyId === J && s.topic === TEMA) continue;
    const et = s.journeyId === J ? "ESTE" : (s.journey.levels ?? []).join("");
    for (const v of (s.vocab ?? []) as Array<{ word: string; type?: string }>) (mapa[String(v.word).toLowerCase()] ??= []).push(`${et}:${v.type ?? "?"}`);
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(mapa));
  const b1 = [...PORTUGUESE_B1_LEMMAS].filter((w) => !isPortugueseA1A2(w));
  const libres = b1.filter((w) => !mapa[w]);
  console.log(`vocab PT mapeado: ${Object.keys(mapa).length} palabras -> ${process.argv[2]}`);
  console.log(`lista B1: ${PORTUGUESE_B1_LEMMAS.size} lemas, ${b1.length} por encima de A1/A2, ${libres.length} sin ensenar en ningun journey PT`);
})().finally(() => p.$disconnect());
