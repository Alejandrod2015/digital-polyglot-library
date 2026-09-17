/**
 * Quita el `gm` de toda entrada de glosa cuyo tipo RESUELTO no sea `noun`.
 * El `gm` es marca de genero del sustantivo; en un homografo (`porta` =
 * puerta / lleva) es residuo del sentido nominal mientras la historia usa el
 * verbal. Recorre TODAS las filas de `dp_tap_glosses_v1`.
 *
 * Uso: npx tsx scripts/_limpiaGmNoSustantivo.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { normalizeVocabType } from "../packages/domain/src/vocabTypes";

const DRY = process.argv.includes("--dry");
const p = new PrismaClient();

type Entrada = { g: string; t?: string; gm?: string; [k: string]: unknown };

(async () => {
  const rows = await p.tapGlossSet.findMany({ select: { id: true, bundle: true, slug: true, glosses: true } });
  let tocadas = 0;
  let filas = 0;
  for (const row of rows) {
    const map = row.glosses as Record<string, Entrada>;
    let cambio = false;
    for (const [word, entry] of Object.entries(map ?? {})) {
      if (!entry || typeof entry !== "object" || !entry.gm) continue;
      const type = normalizeVocabType(entry.t, { word, definition: entry.g }) ?? "other";
      if (type === "noun") continue;
      console.log(`${row.bundle} | ${row.slug || "(global)"} | ${word} | gm=${entry.gm} | t=${entry.t ?? "(sin t)"} -> ${type}`);
      delete entry.gm;
      cambio = true;
      tocadas++;
    }
    if (cambio) {
      filas++;
      if (!DRY) await p.tapGlossSet.update({ where: { id: row.id }, data: { glosses: map } });
    }
  }
  console.log(`\n${DRY ? "[dry] " : ""}entradas sin gm: ${tocadas} en ${filas} filas`);
  await p.$disconnect();
})();
