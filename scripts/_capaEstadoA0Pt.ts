// Solo lectura: filas por historia del bundle del A0 y cuantas entradas no tienen trozo de contexto (c).
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "portuguese-traveler-brazil-a0" }, select: { slug: true, glosses: true } });
  let tot = 0, sinC = 0;
  for (const f of filas.sort((a, b) => a.slug.localeCompare(b.slug))) {
    const g = f.glosses as Record<string, any>; const n = Object.keys(g).length; const s = Object.values(g).filter((e) => !e.c).length;
    if (f.slug) { tot += n; sinC += s; }
    console.log(`${f.slug || "(global)"}\t${n} entradas\t${s} sin c`);
  }
  console.log(`historias: ${filas.length - 1} · entradas ${tot} · sin c ${sinC}`);
}
main().finally(() => p.$disconnect());
