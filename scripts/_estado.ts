import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const b = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle: b } });
  const g = filas.find((f) => f.slug === "")!;
  const gl = g.glosses as Record<string, { g: string; t: string }>;
  console.log(`bundle ${b} | lengua ${g.language} | variante ${g.variant} | ${Object.keys(gl).length} glosas | ${g.slugs.length} historias`);
  console.log("filas por historia:", filas.filter((f) => f.slug !== "").length);
  const conF = filas.filter((f) => f.slug !== "").reduce((a, f) => a + Object.values(f.glosses as Record<string, { f?: unknown }>).filter((e) => e.f).length, 0);
  console.log("entradas con tabla de formas:", conF);
  console.log(g.slugs.join("\n"));
  await p.$disconnect();
})();
