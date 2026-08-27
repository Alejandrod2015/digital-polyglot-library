import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, slugs: true, language: true, variant: true } });
  const globales = filas.filter((f) => f.slug === "");
  const conCapa = new Set(filas.filter((f) => f.slug !== "").map((f) => f.slug));
  for (const g of globales) {
    if (g.bundle.startsWith("talking-points")) continue;
    const hechas = g.slugs.filter((s) => conCapa.has(s)).length;
    console.log(g.bundle.padEnd(34), (g.language ?? "").padEnd(11), (g.variant ?? "").padEnd(10), `${hechas}/${g.slugs.length}`);
  }
  await p.$disconnect();
}
main();
