import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: process.argv[2] } });
  const g = filas.find((f) => f.slug === "")!.glosses as Record<string, { t?: string; g?: string }>;
  const sin = new Map<string, string>();
  for (const f of filas.filter((f) => f.slug !== "")) {
    for (const [w, v] of Object.entries(f.glosses as Record<string, { t?: string; gm?: string; g?: string }>)) {
      const t = v.t ?? g[w]?.t;
      if (t !== "noun") continue;
      if (!v.gm) sin.set(w, v.g ?? g[w]?.g ?? "");
    }
  }
  console.log(`${sin.size} sustantivos sin marca`);
  console.log([...sin.keys()].sort().join(" "));
  await p.$disconnect();
}
main();
