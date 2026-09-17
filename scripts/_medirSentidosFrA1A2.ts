import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const BUNDLES = ["french-friends-france-a1", "french-friends-france-a2"];

const HOMOGRAFOS = [
  "porte", "entre", "ete", "été", "vis", "place", "tour", "livre", "pas",
  "fait", "bien", "sens", "somme", "sort", "marche", "ferme", "avocat",
];

async function main() {
  for (const bundle of BUNDLES) {
    const filas = await prisma.tapGlossSet.findMany({
      where: { bundle, slug: { not: "" } },
      select: { slug: true, glosses: true },
    });
    let semicolon = 0;
    let homografo = 0;
    const semicolonEntries: string[] = [];
    const homografoEntries: string[] = [];
    for (const fila of filas) {
      const glosses = fila.glosses as Record<string, { g: string; t?: string; rev?: boolean; c?: { es: string; en: string } }>;
      for (const [key, v] of Object.entries(glosses)) {
        if (v.g && v.g.includes(";")) {
          semicolon++;
          semicolonEntries.push(`${bundle} / ${fila.slug} / ${key}: g="${v.g}" t=${v.t ?? ""} c=${v.c ? JSON.stringify(v.c) : "NONE"}`);
        }
        if (HOMOGRAFOS.includes(key.toLowerCase())) {
          homografo++;
          homografoEntries.push(`${bundle} / ${fila.slug} / ${key}: g="${v.g}" t=${v.t ?? ""} c=${v.c ? JSON.stringify(v.c) : ""} semicolon=${v.g?.includes(";") ?? false}`);
        }
      }
    }
    console.log(`\n=== ${bundle} ===`);
    console.log(`filas de historia: ${filas.length}`);
    console.log(`(a) entradas con ";" en g: ${semicolon}`);
    console.log(`(b) entradas que citan un homografo de la lista: ${homografo}`);
    console.log("\n-- (a) detalle --");
    semicolonEntries.forEach((l) => console.log(l));
    console.log("\n-- (b) detalle --");
    homografoEntries.forEach((l) => console.log(l));
  }
}

main().finally(() => prisma.$disconnect());
