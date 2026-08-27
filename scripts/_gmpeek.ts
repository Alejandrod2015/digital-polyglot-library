import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: process.argv[2] } });
  const c = new Map<string, number>(); const ej = new Map<string, string>();
  for (const f of filas.filter((x) => x.slug !== "")) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) if (e.gm) { c.set(e.gm, (c.get(e.gm) ?? 0) + 1); if (!ej.has(e.gm)) ej.set(e.gm, w); }
  for (const [k, n] of [...c].sort((a,b)=>b[1]-a[1])) console.log(`"${k}"`.padEnd(12), n, " ej:", ej.get(k));
  await p.$disconnect();
}
main();
