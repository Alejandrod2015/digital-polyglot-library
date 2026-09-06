/** Repone las entradas de capa que sirven al VOCAB y que el limpiador se llevo
 *  por delante: el lema ("cortarse") y la expresion ("a oscuras") no salen
 *  literales en el texto, pero son la clave por la que el panel busca. La
 *  frase se copia de la superficie, que si esta. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const N = (s: string) => s.trim().toLowerCase();
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b1";
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const global = filas.find((f) => f.slug === "")!.glosses as Record<string, any>;
  const historias = await p.journeyStory.findMany({
    where: { slug: { in: filas.find((f) => f.slug === "")!.slugs } },
    select: { slug: true, title: true, text: true, vocab: true },
  });
  let puestas = 0, sinFuente: string[] = [];
  for (const h of historias) {
    const fila = filas.find((f) => f.slug === h.slug);
    if (!fila) continue;
    const g = fila.glosses as Record<string, any>;
    const cuerpo = `${h.title} ${h.text}`.toLowerCase();
    for (const v of ((h.vocab ?? []) as any[])) {
      const lema = N(String(v.word ?? "")), sup = N(String(v.surface ?? ""));
      if (!lema) continue;
      const yaVale = [sup, lema].filter(Boolean).some((k) => g[k]?.c);
      if (yaVale) continue;
      // la frase sale de la superficie si la tiene, y si no del cuerpo
      const fuente = [sup, lema].map((k) => g[k]).find((e) => e?.c);
      const c = fuente?.c;
      if (!c) { sinFuente.push(`${h.slug}·${lema}`); continue; }
      const clave = cuerpo.includes(lema) ? lema : (sup || lema);
      g[clave] = { ...(global[clave] ?? {}), ...(g[clave] ?? {}), c, rev: true };
      puestas++;
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: h.slug! } }, data: { glosses: g } });
  }
  console.log(`entradas repuestas ${puestas}${sinFuente.length ? ` · sin fuente ${sinFuente.length}: ${sinFuente.slice(0, 10).join(" ")}` : ""}`);
  await p.$disconnect();
})();
