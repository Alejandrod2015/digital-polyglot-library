import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const MALAS = /^(devolve|encende|costa|recorda|move|llove|pensa|cerra|entende|sente|prefere|desperta|calenta|serve|repete|veste|mede|solta|colga|roga|sona|soña|dole|morde|ole)[sn]?$/;
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" }, bundle: { startsWith: "spanish-" } }, select: { bundle: true, slug: true, glosses: true } });
  const hits: string[] = [];
  for (const f of filas) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
    for (const fila of [...(e.f?.rows ?? []), ...(e.f?.head ?? [])]) {
      const forma = String(fila[1] ?? "").toLowerCase().split(/\s+/).pop() ?? "";
      if (MALAS.test(forma)) hits.push(`${f.bundle}/${f.slug} ${w}: ${forma}`);
    }
  }
  console.log(`formas rotas todavia guardadas: ${hits.length}`);
  for (const h of hits.slice(0, 12)) console.log("  ", h);
  await p.$disconnect();
})();
