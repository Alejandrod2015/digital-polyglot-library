/** Que forma exacta tiene una entrada de glosa, y que valores de `t` usa el
 *  bundle. Antes de escribir en una fila hay que saber que campos lleva, o se
 *  pierde el `rev` y el lint de copias sin leer salta. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-friends";
const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const tipos = new Map<string, number>();
  for (const f of filas) {
    for (const v of Object.values(f.glosses as Record<string, { t?: string }>)) {
      const t = v?.t ?? "(sin t)";
      tipos.set(t, (tipos.get(t) ?? 0) + 1);
    }
  }
  console.log("valores de t:");
  for (const [t, n] of [...tipos].sort((a, b) => b[1] - a[1])) console.log(`  ${t}  x${n}`);

  for (const w of ["choro", "perdis", "weon", "carrilla"]) {
    console.log(`\n── ${w}`);
    for (const f of filas) {
      const v = (f.glosses as Record<string, unknown>)[w];
      if (!v) continue;
      console.log(`  ${f.slug || "(global)"}: ${JSON.stringify(v)}`);
    }
  }
  await p.$disconnect();
})();
