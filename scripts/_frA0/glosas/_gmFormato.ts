// SOLO LECTURA. Valores de gm usados en todos los bundles (formato y epicenos).
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { bundle: true, glosses: true } });
  const c = new Map<string, { n: number; ej: string[]; b: Set<string> }>();
  for (const f of filas) for (const [w, v] of Object.entries(f.glosses as Record<string, any>)) if (v?.gm) {
    const e = c.get(v.gm) ?? { n: 0, ej: [], b: new Set() }; e.n++; e.b.add(f.bundle); if (e.ej.length < 4) e.ej.push(w); c.set(v.gm, e);
  }
  for (const [k, e] of [...c].sort((a, b) => b[1].n - a[1].n)) console.log(`${JSON.stringify(k).padEnd(14)} ${e.n} · ${e.ej.join(", ")} · ${[...e.b].slice(0, 3).join(", ")}`);
  await p.$disconnect();
})();
