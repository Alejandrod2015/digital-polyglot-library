/** Lee los paradigmas de un bundle uno a uno: forma del texto, infinitivo y
 *  las seis filas. El chequeo de `here` no basta, solo mira una fila. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const bundle = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  const vistos = new Map<string, string>();
  for (const f of filas.filter((x) => x.slug !== "")) {
    for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
      if (!e.f || vistos.has(w)) continue;
      vistos.set(w, `${(e.f.lemma as string).padEnd(24)} ${e.f.rows.map((r: string[]) => r[1]).join(" / ")}`);
    }
  }
  for (const [w, l] of [...vistos].sort()) console.log(" ", w.padEnd(16), l);
  console.log(`\n${vistos.size} paradigmas distintos`);
  await p.$disconnect();
}
main();
