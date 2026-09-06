import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const PUEBLO = /^(levante|malec[óo]n|alga|barca|lancha|muelle|marea|contraventana|farola|embarcadero|red|sardina|pesca|chubasco|grava|lodo|manguera|papelera|contenedor|desag[üu]e|aceituna|campo|bollo|levadura|molde|cuota|cesta)$/i;
(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { vocab: true } });
  const viejas = rows.flatMap((r) => ((r.vocab as Array<{ word: string }>) ?? []).map((v) => v.word))
    .filter((w) => !PUEBLO.test(w));
  const usadas = new Set(JSON.parse(fs.readFileSync("scripts/_b1/g/t1.json", "utf8"))
    .flatMap((s: any) => s.vocab.map((v: any) => v.word)));
  const libres = viejas.filter((w) => !usadas.has(w));
  console.log(`reutilizables sin usar (${libres.length}):`);
  for (let i = 0; i < libres.length; i += 14) console.log("  " + libres.slice(i, i + 14).join(", "));
  await p.$disconnect();
})();
