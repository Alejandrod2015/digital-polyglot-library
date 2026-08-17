// ¿Por qué la app dice "No journeys available for Portuguese (BRAZIL)"?
// Compara los valores EXACTOS que usa cada lado. Solo lee.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const js = await p.journey.findMany({
    where: { language: { contains: "ortug", mode: "insensitive" } },
    select: { id: true, name: true, language: true, variant: true, status: true, levels: true },
  });
  console.log("── Journey (lo que hay en la BD) ──");
  for (const j of js) {
    console.log(`  language=[${j.language}] variant=[${j.variant}] status=${j.status} levels=${j.levels.join(",")}`);
  }

  const langs = await p.language.findMany({ include: { variants: true } });
  console.log("\n── Catálogo Language / LanguageVariant (lo que pide la app) ──");
  for (const l of langs) {
    if (!/portug/i.test(l.code) && !/portug/i.test(l.label)) continue;
    console.log(`  code=[${l.code}] label=[${l.label}]`);
    for (const v of l.variants) console.log(`     variante code=[${v.code}] label=[${v.label}]`);
  }

  // Y el de español, para comparar un caso que SÍ funciona.
  console.log("\n── Para comparar: español (que sí funciona) ──");
  const es = await p.journey.findMany({
    where: { language: { contains: "spanish", mode: "insensitive" }, status: "active" },
    select: { language: true, variant: true, name: true },
    take: 4,
  });
  for (const j of es) console.log(`  language=[${j.language}] variant=[${j.variant}] ${j.name}`);
  for (const l of langs) {
    if (!/spanish/i.test(l.code)) continue;
    console.log(`  catálogo code=[${l.code}] variantes: ${l.variants.map((v) => v.code).join(", ")}`);
  }
}
main().finally(() => p.$disconnect());
