/** SOLO LECTURA. Comprueba el plan de vocab del journey ANTES de la primera
 *  linea de prosa: forma (42+18 por tema), unicidad global de las 420 plazas,
 *  techo de nivel (lista A1A2), y la regla de solape capa por capa: las
 *  ancladas tienen que estar LIBRES; las portables, libres o de la capa
 *  portable reabrible. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
const p = new PrismaClient();
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);

(async () => {
  const plan = JSON.parse(fs.readFileSync("scripts/pt-a2-vocab-plan.json", "utf8"));
  const st = await p.journeyStory.findMany({
    where: { journey: { language: "portuguese" } },
    select: { vocab: true },
  });
  /** lema -> tipo con el que lo enseño quien lo enseño */
  const ensenadas = new Map<string, string>();
  for (const r of st)
    for (const v of (r.vocab ?? []) as Array<{ word?: string; type?: string }>) {
      const w = String(v.word ?? "").toLowerCase();
      if (w) ensenadas.set(w, String(v.type ?? "").toLowerCase());
    }

  const fallos: string[] = [];
  const vistas = new Map<string, string>();
  let nAnc = 0, nPort = 0;

  for (const t of plan.temas as Array<{ slug: string; ancladas: string[]; portables: string[] }>) {
    if (t.ancladas.length !== 18) fallos.push(`${t.slug}: ${t.ancladas.length} ancladas, hacen falta 18`);
    if (t.portables.length !== 42) fallos.push(`${t.slug}: ${t.portables.length} portables, hacen falta 42`);
    nAnc += t.ancladas.length; nPort += t.portables.length;

    for (const [capa, lista] of [["anclada", t.ancladas], ["portable", t.portables]] as const) {
      for (const w0 of lista) {
        const w = w0.toLowerCase();
        const ya = vistas.get(w);
        if (ya) fallos.push(`"${w}" repetida: ${ya} y ${t.slug}/${capa}`);
        else vistas.set(w, `${t.slug}/${capa}`);

        if (!isPortugueseA1A2(w)) fallos.push(`"${w}" (${t.slug}/${capa}) fuera del techo A2: no esta en la lista A1A2`);

        const tipoPrevio = ensenadas.get(w);
        if (capa === "anclada" && tipoPrevio !== undefined)
          fallos.push(`"${w}" (${t.slug}) es anclada pero YA la enseña otro journey PT como ${tipoPrevio || "?"}: las ancladas van a cero`);
        if (capa === "portable" && tipoPrevio !== undefined && !PORT.has(tipoPrevio))
          fallos.push(`"${w}" (${t.slug}) la enseño otro journey como ${tipoPrevio}, que NO es capa portable: no se reabre`);
      }
    }
  }

  console.log(`plazas: ${nAnc + nPort} (${nPort} portables + ${nAnc} ancladas) · distintas: ${vistas.size}`);
  if (fallos.length) {
    console.error(`\n✗ PLAN NO VALIDO: ${fallos.length} fallo(s)\n`);
    for (const f of fallos) console.error("   " + f);
    process.exit(1);
  }
  console.log("✓ plan valido: forma, unicidad, techo de nivel y solape por capa.");
})().finally(() => p.$disconnect());
