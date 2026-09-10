/** Glosas con VARIOS sentidos apilados, y la frase real donde caen.
 *
 *  Ahi es donde se esconde el fallo de «choro»: g decia "thief; cool, tough",
 *  dos sentidos chilenos, y el bundle lo usa en "echar choro" (soltar un
 *  rollo, mexicano) y en "bien choro" (cool). Cuando alguien apila sentidos
 *  separados por punto y coma esta cubriendose en abstracto, sin mirar que
 *  hace la palabra en ESTAS historias.
 *
 *  Señal estrecha a proposito: solo las que apilan sentidos y solo las que
 *  salen en pocas historias, que es donde vive la jerga regional. No corrige
 *  nada; lista para leer.
 *
 *  Uso: _sentidos.ts <bundle> [tope de historias, por defecto 3] */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();

(async () => {
  const bundle = process.argv[2];
  const tope = Number(process.argv[3] ?? 3);
  const filas = await p.tapGlossSet.findMany({ where: { bundle }, select: { slug: true, glosses: true } });
  const porClave = new Map<string, { g: string; usos: Array<{ slug: string; es?: string; en?: string }> }>();
  for (const f of filas) {
    if (!f.slug) continue;
    for (const [w, v] of Object.entries(f.glosses as Record<string, { g?: string; c?: { es?: string; en?: string } }>)) {
      if (!v?.g || !/;/.test(v.g)) continue;
      const e = porClave.get(w) ?? { g: v.g, usos: [] };
      e.usos.push({ slug: f.slug, es: v.c?.es, en: v.c?.en });
      porClave.set(w, e);
    }
  }
  let n = 0;
  for (const [w, e] of [...porClave].sort((a, b) => a[1].usos.length - b[1].usos.length)) {
    if (e.usos.length > tope) continue;
    n++;
    console.log(`\n${w}   ${JSON.stringify(e.g)}`);
    for (const u of e.usos) console.log(`  ${u.slug}: ${JSON.stringify(u.es)} → ${JSON.stringify(u.en)}`);
  }
  console.log(`\n${n} claves con sentidos apilados en ${tope} historias o menos`);
  await p.$disconnect();
})();
