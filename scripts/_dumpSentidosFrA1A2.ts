import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";

const prisma = new PrismaClient();

const BUNDLES = ["french-friends-france-a1", "french-friends-france-a2"];

const HOMOGRAFOS = [
  "porte", "entre", "ete", "été", "vis", "place", "tour", "livre", "pas",
  "fait", "bien", "sens", "somme", "sort", "marche", "ferme", "avocat",
];

async function main() {
  const out: any = {};
  for (const bundle of BUNDLES) {
    const filas = await prisma.tapGlossSet.findMany({
      where: { bundle },
      select: { slug: true, glosses: true },
    });
    out[bundle] = {};
    for (const fila of filas) {
      const glosses = fila.glosses as Record<string, any>;
      const flagged: Record<string, any> = {};
      for (const [key, v] of Object.entries(glosses)) {
        const hasSemi = typeof v.g === "string" && v.g.includes(";");
        const isHomog = HOMOGRAFOS.includes(key.toLowerCase());
        if (hasSemi || isHomog) {
          flagged[key] = v;
        }
      }
      if (Object.keys(flagged).length > 0) {
        out[bundle][fila.slug] = flagged;
      }
    }
  }
  fs.writeFileSync(
    "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/812c0bfa-b136-4a48-bec8-e56a77065401/scratchpad/dump.json",
    JSON.stringify(out, null, 2)
  );
  console.log("done");
}

main().finally(() => prisma.$disconnect());
