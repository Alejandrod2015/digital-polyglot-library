/**
 * Banco de pruebas del B1 antes de tocar saveStory: dice de cada palabra
 * candidata si esta en la lista hasta B1, si ya la ensena un Traveler (tope 0)
 * o un journey de otro tipo (tope 2 por historia). Solo lectura.
 *
 *   npx tsx scripts/_b1/check.ts palabra1 palabra2 ...
 *   npx tsx scripts/_b1/check.ts --file lista.txt
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { createRequire } from "module";
const __r = createRequire(__filename);
try { const q = __r.resolve("server-only"); (__r as unknown as { cache: Record<string, unknown> }).cache[q] = { id: q, filename: q, loaded: true, exports: {} }; } catch { /* noop */ }

const prisma = new PrismaClient();
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

(async () => {
  const args = process.argv.slice(2);
  const words = args[0] === "--file"
    ? fs.readFileSync(args[1], "utf8").split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    : args;
  const rows = await prisma.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } } },
    select: { vocab: true, journey: { select: { typeSlug: true, id: true } } },
  });
  const duro = new Set<string>(); const blando = new Set<string>();
  for (const r of rows) {
    if (r.journey?.id === "cmt5x67ze000l320cpgunu5vi") continue;
    const dest = r.journey?.typeSlug === "traveler" ? duro : blando;
    for (const v of ((r.vocab as Array<{ word?: string }> ?? []))) if (v?.word) dest.add(lema(String(v.word)));
  }
  const { filterSpanishWordsAtOrBelow } = await import("../../src/lib/cefr/spanishLevelJudge");
  const { aboveLevel } = await filterSpanishWordsAtOrBelow(words, "b1");
  const fuera = new Map(aboveLevel.map((a) => [a.word.toLowerCase(), a.judgedLevel]));
  let ok = 0;
  for (const w of words) {
    const l = lema(w);
    const enLista = isSpanishUpToLevel(w, "b1");
    const juez = fuera.has(w.toLowerCase()) ? `JUEZ:${String(fuera.get(w.toLowerCase())).toUpperCase()}` : "juez:ok";
    const t = duro.has(l) ? "YA-TRAVELER" : blando.has(l) ? "otro-tipo" : "libre";
    const nivel = enLista ? "<=B1" : "fuera-de-lista";
    if (!fuera.has(w.toLowerCase()) && t === "libre") ok++;
    console.log(`${w.padEnd(20)} ${nivel.padEnd(15)} ${juez.padEnd(10)} ${t}`);
  }
  console.log(`\n${ok}/${words.length} usables como plaza de vocab sin peros.`);
})().finally(() => prisma.$disconnect());
