// Corrige g/t de glosas del bundle del A0 PT-BR (fila global y filas de historia) desde un JSON { palabra: { g, t } }.
// Solo toca las palabras de la lista; conserva c, f y el resto de cada entrada.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const fix = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Record<string, { g: string; t: string }>;
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "portuguese-traveler-brazil-a0" } });
  let n = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>; let cambio = false;
    for (const [w, v] of Object.entries(fix)) if (g[w]) { g[w] = { ...g[w], g: v.g, t: v.t }; cambio = true; n++; }
    if (cambio) await p.tapGlossSet.update({ where: { id: f.id }, data: { glosses: g as never } });
  }
  console.log(`entradas corregidas: ${n} (en ${filas.length} filas)`);
}
main().finally(() => p.$disconnect());
