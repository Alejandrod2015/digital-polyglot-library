/** Cuenta las palabras que el lector NO alcanza por la elision: token con
 *  apostrofo cuya cola no esta en el bundle. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const TAPPABLE = /[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu;
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { slug: "" } });
  for (const b of filas) {
    if (b.bundle.startsWith("talking-points")) continue;
    const g = b.glosses as Record<string, unknown>;
    const hist = await p.journeyStory.findMany({ where: { slug: { in: b.slugs } }, select: { title: true, text: true } });
    const perdidas = new Set<string>();
    let conApos = 0;
    for (const h of hist) {
      for (const t of `${h.title}. ${h.text}`.match(TAPPABLE) ?? []) {
        if (!t.includes("'") && !t.includes("’")) continue;
        conApos++;
        const cola = t.toLowerCase().split(/['’]/).slice(1).join("").trim();
        if (cola && !g[cola]) perdidas.add(cola);
      }
    }
    if (perdidas.size) console.log(`${b.bundle.padEnd(30)} ${String(conApos).padStart(4)} con apostrofo · ${perdidas.size} formas inalcanzables: ${[...perdidas].sort().slice(0, 12).join(" ")}`);
  }
  await p.$disconnect();
})();
