/**
 * Vuelca los bundles de glosas del repo a la base, que es donde viven ahora.
 *
 *   npx tsx scripts/syncTapGlosses.ts          escribe
 *   npx tsx scripts/syncTapGlosses.ts --check  compara y falla si difieren
 *
 * Existe SOLO para la migracion del 2026-08-26 y para poder comprobar que la
 * base dice exactamente lo mismo que decia el repo. Una vez borrados los JSON,
 * la base es la unica fuente y este script se queda como el verificador de
 * aquel volcado.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma";

const DIR = "src/data/tapGlosses";
const prisma = new PrismaClient();

/** JSONB no conserva el orden de las claves, asi que comparar el texto plano
 *  da siempre distinto aunque el contenido sea identico. Se canoniza. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) o[k] = canon((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}

type Bundle = {
  language?: string; variant?: string; slugs: string[];
  glosses: Record<string, unknown>;
  byStory?: Record<string, Record<string, unknown>>;
};

async function main() {
  const check = process.argv.includes("--check");
  if (!fs.existsSync(DIR)) {
    console.error(`${DIR} ya no existe: la base es la fuente y no hay nada que volcar.`);
    process.exit(check ? 0 : 1);
  }
  const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  let filas = 0, distintas = 0;

  for (const f of ficheros) {
    const nombre = f.replace(/\.json$/, "");
    const b = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Bundle;
    // Fila global (slug ""), mas una por historia con capa propia.
    const sets: Array<{ slug: string; glosses: Record<string, unknown> }> = [
      { slug: "", glosses: b.glosses },
      ...Object.entries(b.byStory ?? {}).map(([slug, glosses]) => ({ slug, glosses })),
    ];
    for (const s of sets) {
      filas++;
      if (check) {
        const fila = await prisma.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: nombre, slug: s.slug } } });
        const igual = fila && JSON.stringify(canon(fila.glosses)) === JSON.stringify(canon(s.glosses));
        if (!igual) { distintas++; console.error(`  DIFIERE ${nombre} / ${s.slug || "(global)"}${fila ? "" : " (no esta en la base)"}`); }
        continue;
      }
      await prisma.tapGlossSet.upsert({
        where: { bundle_slug: { bundle: nombre, slug: s.slug } },
        create: { bundle: nombre, slug: s.slug, language: b.language ?? null, variant: b.variant ?? null,
                  slugs: s.slug === "" ? b.slugs : [], glosses: s.glosses as never },
        update: { language: b.language ?? null, variant: b.variant ?? null,
                  slugs: s.slug === "" ? b.slugs : [], glosses: s.glosses as never },
      });
    }
  }
  if (check) {
    console.log(distintas === 0
      ? `sync: la base dice lo mismo que el repo (${filas} filas)`
      : `sync: ${distintas} de ${filas} filas DIFIEREN`);
    process.exit(distintas === 0 ? 0 : 1);
  }
  console.log(`sync: ${filas} filas escritas desde ${ficheros.length} bundles`);
  await prisma.$disconnect();
}
main();
