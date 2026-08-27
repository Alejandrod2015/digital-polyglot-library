import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const bundle = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  const g = filas.find((f) => f.slug === "")!.glosses as Record<string, any>;
  const s = new Set<string>();
  for (const f of filas.filter((x) => x.slug !== "")) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) if ((e.t ?? g[w]?.t) === "noun") s.add(w);
  console.log(s.size, "sustantivos\n" + [...s].sort().join(" "));
  await p.$disconnect();
}
main();
