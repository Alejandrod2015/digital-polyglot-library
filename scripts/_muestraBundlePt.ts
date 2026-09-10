// Solo lectura: forma real de un bundle PT existente (fila global y una fila de historia).
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const g = await p.tapGlossSet.findFirst({ where: { bundle: "portuguese-traveler-brazil-a1", slug: "" } });
  const gl = (g?.glosses ?? {}) as Record<string, any>;
  console.log("GLOBAL keys:", Object.keys(g ?? {}).join(","), "| language", g?.language, "variant", g?.variant, "| slugs", (g?.slugs ?? []).length, "| glosses", Object.keys(gl).length);
  console.log("GLOBAL ejemplo:", JSON.stringify(Object.entries(gl).slice(0, 3)));
  const s = await p.tapGlossSet.findFirst({ where: { bundle: "portuguese-traveler-brazil-a1", NOT: { slug: "" } } });
  const sg = (s?.glosses ?? {}) as Record<string, any>;
  console.log("HISTORIA", s?.slug, "| entradas", Object.keys(sg).length);
  console.log("HISTORIA ejemplo:", JSON.stringify(Object.entries(sg).slice(0, 2)).slice(0, 900));
}
main().finally(() => p.$disconnect());
