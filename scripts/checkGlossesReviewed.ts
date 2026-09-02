/**
 * LINT: ninguna glosa COPIADA sin leer puede publicarse ni narrarse.
 *
 * WHY: el copiador de `rebuildTapGlosses.ts` va por PALABRA y no mira la
 * oracion, asi que arrastra el sentido que la palabra tenia en el journey de
 * origen. El porton `citaAjena` solo caza a las que CITAN una expresion; el
 * resto no lleva marca: `sierra` llego como "mountain range" y cayo sobre una
 * sierra de cortar, y el informe decia "al dia" porque comprueba que HAYA
 * glosa, no que sea la correcta. El usuario lo encontro tocando la palabra en
 * el lector el 2026-09-02.
 *
 * Por eso toda copia nace con `rev: false` y este lint la bloquea hasta que
 * alguien la lea contra su frase. Lo que garantiza: que una copia sin leer no
 * llega al lector. Lo que NO puede garantizar ninguna maquina es que el
 * sentido leido sea el bueno; eso lo decide quien lee.
 *
 * Leerlas:  npx tsx scripts/reviewCopiedGlosses.ts <bundle>
 * Run:      npm run lint:glosses-reviewed
 * Exit: 0 limpio, 1 con el recuento por bundle.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.tapGlossSet.findMany({ select: { bundle: true, slug: true, glosses: true } });
  const pend = new Map<string, string[]>();
  let total = 0;

  for (const r of rows) {
    for (const [k, v] of Object.entries((r.glosses ?? {}) as Record<string, { rev?: boolean }>)) {
      total++;
      if (v?.rev === false) pend.set(r.bundle, [...(pend.get(r.bundle) ?? []), `${r.slug || "global"}:${k}`]);
    }
  }

  if (pend.size === 0) {
    console.log(`glosses-reviewed: limpio (${total} glosas, ninguna copia sin leer)`);
    return;
  }

  console.error(`glosses-reviewed: ${pend.size} bundle(s) con copias sin leer\n`);
  for (const [b, ks] of pend) {
    console.error(`  ${b}: ${ks.length}`);
    console.error(`     ${ks.slice(0, 12).join(", ")}${ks.length > 12 ? " ..." : ""}`);
  }
  console.error(
    "\nUna copia trae el sentido del journey de origen. Leela contra la frase\n" +
      "donde cae antes de publicar o narrar:\n" +
      "  npx tsx scripts/reviewCopiedGlosses.ts <bundle>"
  );
  process.exitCode = 1;
})().finally(() => prisma.$disconnect());
