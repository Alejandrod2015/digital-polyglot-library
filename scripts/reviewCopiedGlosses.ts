/**
 * Vuelca cada glosa COPIADA de un bundle hermano junto a la frase de ESTE
 * journey donde cae, para leerlas una a una.
 *
 * Existe porque `rebuildTapGlosses.ts` copia por PALABRA y no mira la oracion.
 * Su porton mecanico (`citaAjena`) caza solo las copias que CITAN su
 * expresion; las que traen otro sentido sin marca ninguna (`sierra` como
 * "mountain range" cayendo sobre una sierra de cortar) solo se ven leyendo. Y
 * el informe de rebuild dice "al dia" igual, porque comprueba que HAYA glosa,
 * no que sea la correcta.
 *
 * Portado a la base el 2026-09-02: la version de agosto leia
 * src/data/tapGlosses, que dejo de existir con la migracion del 26 de agosto.
 *
 * Uso: npx tsx scripts/reviewCopiedGlosses.ts <bundle> [--pend] [--tsv] [--limit=N]
 *      --pend  solo las que siguen sin leer (rev:false)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

(async () => {
  const name = process.argv[2];
  if (!name) throw new Error("uso: reviewCopiedGlosses.ts <bundle> [--pend] [--tsv]");
  const soloPend = process.argv.includes("--pend");
  const tsv = process.argv.includes("--tsv");
  const lim = Number((process.argv.find((a) => a.startsWith("--limit=")) ?? "").split("=")[1] || 0);

  const rows = await prisma.tapGlossSet.findMany({
    where: { bundle: name },
    select: { slug: true, glosses: true },
  });
  if (!rows.length) throw new Error(`no hay bundle ${name}`);

  const out: string[] = [];
  for (const r of rows) {
    if (!r.slug) continue; // el global no tiene frase donde caer
    for (const [k, v] of Object.entries((r.glosses ?? {}) as Record<string, any>)) {
      if (soloPend && v?.rev !== false) continue;
      const frase = v?.c?.es ?? "";
      const en = v?.c?.en ?? "";
      out.push(
        tsv
          ? [r.slug, k, v?.t ?? "", v?.g ?? "", frase, en].join("\t")
          : `${k.padEnd(16)} ${String(v?.t ?? "").padEnd(10)} "${v?.g ?? ""}"\n` +
            `${" ".repeat(16)} ${frase}\n${" ".repeat(16)} ${en}   [${r.slug}]`
      );
    }
  }
  const lista = lim > 0 ? out.slice(0, lim) : out;
  console.log(lista.join(tsv ? "\n" : "\n\n"));
  console.error(`\n${out.length} glosa(s)${soloPend ? " sin leer" : " copiadas o propias"} en ${name}`);
})().finally(() => prisma.$disconnect());
