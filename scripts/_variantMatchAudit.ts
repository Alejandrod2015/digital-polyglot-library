// ¿Encuentra el selector de la app CADA journey publicado?
//
// Si una variante no casa, el journey no aparece en el paso 2 y no se emite
// ningún error: la pantalla dice "No journeys available", igual que si no
// hubiera contenido. Solo lee.
//   npx tsx scripts/_variantMatchAudit.ts
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { checkSelectorFindsVariant, loadSelectorOptions } from "./selectorVariants";

const p = new PrismaClient();

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    select: { name: true, language: true, variant: true },
    orderBy: [{ language: "asc" }, { variant: "asc" }],
  });

  const opciones = loadSelectorOptions();
  console.log(`El selector ofrece ${opciones.length} opciones de idioma.\n`);

  let rotos = 0;
  for (const j of journeys) {
    const check = checkSelectorFindsVariant(j.language, j.variant);
    if (!check.ok) rotos++;
    const cabecera = `${j.language}/${j.variant} · ${j.name}`;
    console.log(`${check.ok ? "✓" : "✗"} ${cabecera}`);
    console.log(`    ${check.reason}`);
  }

  console.log(
    rotos === 0
      ? `\n✓ los ${journeys.length} journeys publicados son visibles en el selector`
      : `\n✗ ${rotos} journey(s) publicados que la app NO puede mostrar`
  );
  if (rotos > 0) process.exitCode = 1;
}

main().finally(() => p.$disconnect());
