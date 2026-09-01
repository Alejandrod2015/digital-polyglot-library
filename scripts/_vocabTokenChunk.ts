import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
/** Para cada historia con capa: ¿los TOKENS del texto que son vocabulario
 *  curado tienen trozo? Se aproxima el token por prefijo del lema. */
(async () => {
  const capa = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const conC = capa.filter((f) => Object.values(f.glosses as Record<string, { c?: unknown }>).some((v) => v?.c));
  let tokens = 0, conTrozo = 0; const ej: string[] = [];
  for (const f of conC.slice(0, 40)) {
    const st = await p.journeyStory.findFirst({ where: { slug: f.slug }, select: { text: true, vocab: true } });
    if (!st?.vocab || !st.text) continue;
    const g = f.glosses as Record<string, { c?: { es: string } }>;
    const enTexto = new Set((String(st.text).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []));
    for (const v of st.vocab as Array<{ word?: string }>) {
      const lema = (v.word ?? "").trim().toLowerCase();
      if (!lema || lema.includes(" ")) continue;
      // el token del texto que corresponde: exacto, o el que comparte raiz
      const raiz = lema.slice(0, Math.max(4, lema.length - 2));
      const cand = enTexto.has(lema) ? lema : [...enTexto].find((t) => t.startsWith(raiz));
      if (!cand) continue;
      tokens++;
      if (g[cand]?.c) { conTrozo++; if (ej.length < 5) ej.push(`${lema} -> ${cand}: "${g[cand]!.c!.es}"`); }
      else if (ej.length < 5) ej.push(`${lema} -> ${cand}: SIN TROZO`);
    }
  }
  console.log(`tokens de vocab localizados en el texto: ${tokens}`);
  console.log(`  con trozo en la capa: ${conTrozo} (${Math.round((conTrozo / tokens) * 100)}%)`);
  console.log(ej.join("\n"));
  await p.$disconnect();
})();
