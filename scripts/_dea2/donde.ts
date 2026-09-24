import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const claves = process.argv.slice(2);
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "german-friends-a2" }, select: { slug:true, glosses:true } });
  for (const k of claves) {
    const con = filas.filter(f => f.slug && (f.glosses as any)[k]).map(f => f.slug);
    const g = (filas.find(f=>!f.slug)!.glosses as any)[k];
    console.log(`${k}: global=${g ? JSON.stringify(g.g) : "NO"} · historias: ${con.join(", ") || "ninguna"}`);
    for (const s of con) { const e=(filas.find(f=>f.slug===s)!.glosses as any)[k]; console.log(`    ${s}: g=${JSON.stringify(e.g)} c="${e.c?.es}"`); }
  }
  await p.$disconnect();
})();
