// SOLO LECTURA. Glosas globales de french-friends-a0 con varios sentidos (";")
// y el trozo de cada historia donde caen, para elegir el sentido de la escena.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: "french-friends-a0" }, select: { slug: true, glosses: true } });
  const g = rows.find((r) => r.slug === "")!.glosses as Record<string, any>;
  const multi = Object.keys(g).filter((k) => String(g[k].g).includes(";")).sort();
  for (const k of multi) {
    const usos = rows.filter((r) => r.slug && (r.glosses as any)[k]?.c).map((r) => `${r.slug}: ${(r.glosses as any)[k].c.es}${(r.glosses as any)[k].g !== g[k].g ? "  [ya pisada]" : ""}`);
    console.log(`## ${k} = ${g[k].g}\n   ${usos.join("\n   ")}`);
  }
  console.log(`\n${multi.length} glosas con varios sentidos`);
  await p.$disconnect();
})();
