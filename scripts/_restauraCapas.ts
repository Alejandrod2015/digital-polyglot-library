/** Scratch: devuelve tapGlossSet a la copia de seguridad, fila a fila. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  const copia = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{
    bundle: string;
    slug: string;
    glosses: unknown;
  }>;
  const dry = process.argv.includes("--dry");
  const actuales = await prisma.tapGlossSet.findMany({ select: { bundle: true, slug: true, glosses: true } });
  const ahora = new Map(actuales.map((r) => [`${r.bundle}|${r.slug}`, JSON.stringify(r.glosses)]));
  let n = 0;
  for (const fila of copia) {
    const clave = `${fila.bundle}|${fila.slug}`;
    if (!ahora.has(clave)) continue;
    if (ahora.get(clave) === JSON.stringify(fila.glosses)) continue;
    n++;
    if (!dry) {
      await prisma.tapGlossSet.update({
        where: { bundle_slug: { bundle: fila.bundle, slug: fila.slug } },
        data: { glosses: fila.glosses as never },
      });
    }
  }
  console.log(`restauradas ${n} fila(s)${dry ? " (dry)" : ""}`);
})().finally(() => prisma.$disconnect());
