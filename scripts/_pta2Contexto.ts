/**
 * La capa de CONTEXTO del A2 PT, historia a historia.
 *
 * Sin argumentos: cuenta cuantas palabras tocables tiene cada historia y
 * cuantas ya tienen su trozo, que es lo que mide `lint:gloss-context`.
 *
 * Con un slug: vuelca cada palabra que AUN no tiene trozo junto a la ORACION
 * donde cae, que es de donde sale el trozo. No inventa nada; pone las dos
 * cosas una al lado de la otra para poder escribirlo.
 *
 *   npx tsx scripts/_pta2Contexto.ts
 *   npx tsx scripts/_pta2Contexto.ts <slug>
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const p = new PrismaClient();

(async () => {
  const slugPedido = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, slugs: true, glosses: true } });
  const global = (filas.find((f) => !f.slug)?.glosses ?? {}) as Record<string, { g?: string; t?: string }>;
  const porHistoria = new Map(
    filas.filter((f) => f.slug).map((f) => [f.slug, (f.glosses ?? {}) as Record<string, { c?: unknown }>]),
  );
  const slugs = (filas.find((f) => !f.slug) as { slugs?: string[] } | undefined)?.slugs ?? [];

  const historias = await p.journeyStory.findMany({
    where: { slug: { in: slugs.length ? slugs : [...porHistoria.keys()] } },
    select: { slug: true, title: true, text: true, topic: true, slotIndex: true },
  });
  historias.sort((a, b) => (a.topic ?? "").localeCompare(b.topic ?? "") || a.slotIndex - b.slotIndex);

  let totalFalta = 0, totalTocables = 0;
  for (const h of historias) {
    const propia = porHistoria.get(h.slug!) ?? {};
    const texto = `${h.title}. ${h.text}`;
    const tocables = new Set<string>();
    for (const m of texto.matchAll(TOCABLE)) {
      const w = m[0].toLowerCase();
      if (global[w]) tocables.add(w);
    }
    const faltan = [...tocables].filter((w) => !(propia[w] as { c?: unknown } | undefined)?.c);
    totalFalta += faltan.length;
    totalTocables += tocables.size;

    if (!slugPedido) {
      console.log(`${(h.slug ?? "").padEnd(28)} ${String(tocables.size - faltan.length).padStart(3)}/${String(tocables.size).padEnd(3)} con trozo`);
      continue;
    }
    if (h.slug !== slugPedido) continue;

    const frases = texto.split(/(?<=[.!?…”])\s+/).map((f) => f.trim()).filter(Boolean);
    const yaVista = new Set<string>();
    for (const f of frases) {
      const aqui = [...new Set((f.toLowerCase().match(TOCABLE) ?? []))]
        .filter((w) => faltan.includes(w) && !yaVista.has(w));
      if (!aqui.length) continue;
      aqui.forEach((w) => yaVista.add(w));
      console.log(`\n${f}`);
      for (const w of aqui) console.log(`   ${w}  [${global[w].t ?? "?"}]  ${global[w].g ?? ""}`);
    }
  }
  if (!slugPedido) console.log(`\nTOTAL: ${totalTocables - totalFalta}/${totalTocables} con trozo · faltan ${totalFalta}`);
  await p.$disconnect();
})();
