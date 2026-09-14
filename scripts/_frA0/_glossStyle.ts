// SOLO LECTURA. Muestra del estilo de french-expat-lyon: global por tipo y capa de una historia.
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  const g: any = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "french-expat-lyon", slug: "" } } });
  const porTipo = new Map<string, string[]>();
  for (const [k, v] of Object.entries(g.glosses as Record<string, any>)) { const a = porTipo.get(v.t) ?? []; if (a.length < 8) a.push(`${k} = ${v.g}`); porTipo.set(v.t, a); }
  for (const [t, a] of porTipo) console.log(`[${t}]`, a.join(" | "));
  const capa: any = await p.tapGlossSet.findFirst({ where: { bundle: "french-expat-lyon", slug: { not: "" } } });
  console.log("\ncapa", capa.slug, Object.keys(capa.glosses).length, "entradas");
  console.log(JSON.stringify(Object.fromEntries(Object.entries(capa.glosses).slice(0, 12)), null, 0).slice(0, 2500));
  await p.$disconnect();
})();
