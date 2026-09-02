/**
 * LINT: toda palabra glosada que se pueda TOCAR en una historia tiene que
 * tener su contexto EN ESA historia.
 *
 * WHY: la tarjeta del lector muestra dos lineas, el sentido y la frase donde
 * cae. Si la palabra solo vive en la fila global del bundle, sin `c`, la
 * tarjeta repite la definicion dos veces: el 2026-09-02 el usuario toco
 * `carga` y leyo "load, cargo" arriba y "load, cargo" abajo.
 *
 * El barrido anterior no lo veia porque comprobaba las entradas que YA tenian
 * contexto, y estas no tienen ninguno.
 *
 * Run:  npm run lint:gloss-context
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const TAPPABLE = /\p{L}[\p{L}\p{M}'-]*/gu;

(async () => {
  const bundle = process.argv[2] ?? "spanish-traveler-latam-a2";
  const rows = await prisma.tapGlossSet.findMany({
    where: { bundle }, select: { slug: true, glosses: true },
  });
  const global = (rows.find((r) => !r.slug)?.glosses ?? {}) as Record<string, { g?: string }>;
  const porHistoria = new Map(
    rows.filter((r) => r.slug).map((r) => [r.slug, (r.glosses ?? {}) as Record<string, { c?: unknown }>])
  );

  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: [...porHistoria.keys()] } },
    select: { slug: true, title: true, text: true },
  });

  let huecos = 0;
  for (const s of stories) {
    const propias = porHistoria.get(s.slug)!;
    const faltan = new Set<string>();
    for (const m of `${s.title}. ${s.text}`.matchAll(TAPPABLE)) {
      const k = m[0].toLowerCase();
      if (!global[k]) continue;                       // no es glosable
      const v = propias[k] as { c?: unknown } | undefined;
      if (!v || !(v as any).c) faltan.add(k);
    }
    if (faltan.size) {
      huecos += faltan.size;
      console.error(`  ${s.slug}: ${faltan.size} sin contexto (${[...faltan].slice(0, 10).join(", ")})`);
    }
  }

  if (huecos === 0) {
    console.log(`gloss-context: limpio (${stories.length} historias, ninguna palabra tocable sin su frase)`);
    return;
  }
  console.error(`\ngloss-context: ${huecos} palabra(s) tocables sin contexto en ${bundle}`);
  console.error("La tarjeta les repite la definicion dos veces. Escribe su frase en la fila de la historia.");
  process.exitCode = 1;
})().finally(() => prisma.$disconnect());
