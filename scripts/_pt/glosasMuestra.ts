/** SOLO LECTURA. Muestras del bundle PT: entradas globales y de capa, y los valores de `t`. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: { in: ["portuguese-traveler-brazil-a2", "portuguese-traveler-brazil-b2"] } }, select: { bundle: true, slug: true, glosses: true } });
  const tipos = new Map<string, number>();
  for (const f of filas) for (const e of Object.values(f.glosses as Record<string, { t?: string }>)) tipos.set(String(e.t), (tipos.get(String(e.t)) ?? 0) + 1);
  console.log("t:", [...tipos].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));
  const capa = filas.find((f) => f.bundle.endsWith("b2") && f.slug)!;
  const g = capa.glosses as Record<string, unknown>;
  const want = ["de", "que", "não", "ela", "disse", "perguntou", "com", "mas", "para", "muito", "casa", "tinha", "ficou", "já", "se", "lhe", "pela", "no", "num", "dela"];
  console.log(`== capa ${capa.slug}`);
  for (const k of want) if (g[k]) console.log(`${k}: ${JSON.stringify(g[k])}`);
  const i = 0; const ks = Object.keys(g).slice(0, 12);
  for (const k of ks) if (!want.includes(k)) console.log(`${k}: ${JSON.stringify(g[k])}`);
})().finally(() => p.$disconnect());
