// ¿Casa CADA variante que ofrece el selector con la que Studio persiste?
// Si no casan, el journey desaparece del paso 2 sin ningún error. Solo lee.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

// Reimplementación 1:1 de regionFamily leyendo los sets del propio archivo,
// para que el audit siga al código y no a una copia que se quede vieja.
const src = readFileSync("apps/mobile/src/mobile/LanguageFlag.tsx", "utf8");
function setOf(name: string): Set<string> {
  const m = src.match(new RegExp(`const ${name} = new Set<string>\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) throw new Error(`no encuentro ${name}`);
  return new Set(Array.from(m[1].matchAll(/"([^"]+)"/g)).map((x) => x[1]));
}
const FAM: Array<[Set<string>, string]> = [
  [setOf("LATAM_REGION_CODES"), "latam"],
  [setOf("SPAIN_REGION_CODES"), "spain"],
  [setOf("UK_REGION_CODES"), "uk"],
  [setOf("PORTUGAL_REGION_CODES"), "pt"],
  [setOf("BRAZIL_REGION_CODES"), "brazil"],
];
function regionFamily(code: string | null | undefined): string {
  const v = (code ?? "").trim().toLowerCase();
  if (!v) return "";
  for (const [set, fam] of FAM) if (set.has(v)) return fam;
  return v;
}

// Las opciones que ofrece el selector, leídas del propio componente.
const panel = readFileSync("apps/mobile/src/mobile/JourneysPanel.tsx", "utf8");
const opciones = Array.from(
  panel.matchAll(/\{ key: "[^"]+", name: "([^"]+)", variant: (?:"([^"]+)"|null)/g)
).map((m) => ({ name: m[1], variant: m[2] ?? null }));

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    select: { name: true, language: true, variant: true },
  });

  console.log("Journey publicado            selector ofrece   ¿casan?");
  let rotos = 0;
  for (const j of journeys) {
    const cand = opciones.filter((o) => o.name.toLowerCase() === j.language.toLowerCase());
    // La regla REAL del panel: una opción sin variante no filtra nada, así
    // que ve todos los journeys de su idioma. Solo las opciones CON variante
    // comparan familias. Sin esto el audit marcaba alemán como roto.
    const casa = cand.find((o) => o.variant === null || regionFamily(o.variant) === regionFamily(j.variant));
    const etiqueta = casa
      ? casa.variant === null
        ? "sí  (opción sin variante: no filtra)"
        : `sí  (${casa.variant} → ${regionFamily(casa.variant)})`
      : `NO  ← el journey no aparece en el paso 2`;
    if (!casa) rotos++;
    console.log(
      `${(j.language + "/" + j.variant).padEnd(26)} ${(cand.map((c) => c.variant ?? "—").join("|") || "ninguna").padEnd(17)} ${etiqueta}`
    );
  }
  console.log(`\n${rotos === 0 ? "✓ todos casan" : `✗ ${rotos} journey(s) invisibles en el selector`}`);
}
main().finally(() => p.$disconnect());
