/**
 * Monta `src/data/tapGlosses/spanish-traveler-spain-a2.json`.
 *
 * Tres capas, en este orden:
 *   1. lo COPIADO de un paquete hermano de espanol (686 tokens),
 *   2. encima, `arregladas.json`: las copias que traian el sentido de OTRO
 *      journey y se releyeron contra la frase de ESTA historia
 *      (`feedback_gloss_in_context`): `rosa` decia "pink" y aqui es la
 *      panadera, `banqueta` decia "the sidewalk" (mexicano) y aqui es un
 *      taburete, `coraje` decia "anger" y aqui es el valor,
 *   3. y `nuevas-*.json`, las 266 que no existian en ningun paquete.
 *
 * Si queda un token del cuerpo sin glosa, NO ESCRIBE: un paquete a medias es
 * peor que ninguno, porque el usuario no sabe cual falla.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
const TAPPABLE = /\p{L}+(?:-\p{L}+)*/gu;
const HERMANOS = [
  "spanish-friends-spain-a0", "spanish-traveler-latam", "spanish-friends",
  "spanish-friends-colombia", "spanish-friends-argentina", "spanish-traveler-mexico-a0",
  "spanish-friends-mexico", "talking-points-es",
];
(async () => {
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmt70xfyt000l3283gxd70wck" },
    select: { slug: true, title: true, text: true, topic: true, slotIndex: true },
  });
  const j = await p.journey.findUnique({ where: { id: "cmt70xfyt000l3283gxd70wck" }, select: { topics: true } });
  const orden = j?.topics ?? [];
  st.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const tokens = new Set<string>();
  for (const s of st) for (const m of `${s.title} ${s.text}`.matchAll(TAPPABLE)) tokens.add(m[0].toLowerCase());

  const g: Record<string, { g: string; t: string }> = {};
  for (const h of HERMANOS) {
    const raw = JSON.parse(fs.readFileSync(`src/data/tapGlosses/${h}.json`, "utf8"));
    const src: Record<string, any> = raw.glosses ?? raw;
    for (const [k, v] of Object.entries(src)) {
      if (!tokens.has(k) || g[k]) continue;
      g[k] = typeof v === "string" ? { g: v, t: "other" } : { g: v.g, t: v.t ?? "other" };
    }
  }
  const copiadas = Object.keys(g).length;
  for (const f of ["arregladas", "nuevas-1", "nuevas-2", "nuevas-3"]) {
    const src = JSON.parse(fs.readFileSync(`scripts/_a2/glosas/${f}.json`, "utf8"));
    for (const [k, v] of Object.entries(src as Record<string, { g: string; t: string }>)) g[k] = v;
  }
  const faltan = [...tokens].filter((t) => !g[t]);
  const sobran = Object.keys(g).filter((k) => !tokens.has(k));
  console.log(`${tokens.size} tokens · ${copiadas} copiados · ${Object.keys(g).length} glosas`);
  if (sobran.length) console.log(`glosas que ya no usa ningun cuerpo: ${sobran.join(", ")}`);
  if (faltan.length) {
    console.error(`\nFALTAN ${faltan.length}: ${faltan.slice(0, 30).join(", ")}\nNo se escribe nada.`);
    process.exit(1);
  }
  const salida = {
    slugs: st.map((s) => s.slug!),
    glosses: Object.fromEntries(Object.keys(g).sort().map((k) => [k, g[k]])),
  };
  fs.writeFileSync("src/data/tapGlosses/spanish-traveler-spain-a2.json", JSON.stringify(salida, null, 1) + "\n");
  console.log(`\nescrito src/data/tapGlosses/spanish-traveler-spain-a2.json · ${salida.slugs.length} slugs`);
})().finally(() => p.$disconnect());
