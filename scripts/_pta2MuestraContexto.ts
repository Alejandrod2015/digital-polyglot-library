/** SOLO LECTURA. Como es la capa de contexto en un bundle hermano ya hecho:
 *  cuantas palabras por historia y que forma tienen los trozos. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const B = process.argv[2] ?? "portuguese-traveler-brazil-b1";
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const conSlug = filas.filter((f) => f.slug);
  console.log(`${B}: ${conSlug.length} filas de historia`);
  const primera = conSlug[0];
  if (!primera) { await p.$disconnect(); return; }
  const g = primera.glosses as Record<string, { g?: string; c?: { es?: string; en?: string }; f?: unknown }>;
  const conC = Object.entries(g).filter(([, v]) => v?.c);
  console.log(`${primera.slug}: ${Object.keys(g).length} entradas, ${conC.length} con trozo\n`);
  for (const [w, v] of conC.slice(0, 14))
    console.log(`  ${w}\n    es: ${v.c!.es}\n    en: ${v.c!.en}${v.f ? "\n    (+ formas)" : ""}`);
  await p.$disconnect();
})();
