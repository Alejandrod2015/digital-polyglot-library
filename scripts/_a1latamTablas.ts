/** Las DOS tablas del A1 latam: por temas (produccion) y por historias
 *  (vocabulario). Se dan juntas y en este orden cuando el usuario pide "la
 *  tabla del journey" a secas.
 *
 *  Dos criterios que ya se contaron mal antes y aqui van fijados:
 *  - la escalera cuenta HISTORIAS distintas cuyo cuerpo contiene la forma, no
 *    veces; y compara con limite de palabra, no por prefijo de 4 letras como
 *    hacia `_ladderTable.ts`, que inflaba "abrir" con "abre" y "abrigo".
 *  - la practica se busca por `JourneyStory.id`, nunca por slug (da 0/21). */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const CIUDAD: Record<string, string> = {
  "night-buses": "Cusco", "prices-and-change": "Coyoacán", "calls-and-messages": "Cartagena",
  "help-and-repairs": "Oaxaca", "names-for-things": "San Telmo",
  "doors-and-neighbours": "Barranquilla", "plans-and-invitations": "Palermo",
};
const TEMA: Record<string, string> = {
  "night-buses": "Night Buses", "prices-and-change": "Prices & Change",
  "calls-and-messages": "Calls & Messages", "help-and-repairs": "Help & Repairs",
  "names-for-things": "Names for Things", "doors-and-neighbours": "Doors & Neighbours",
  "plans-and-invitations": "Plans & Invitations",
};
const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(el|la|los|las|un|una)\s+/, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sale = (cuerpo: string, forma: string) =>
  new RegExp(`(?<!\\p{L})${esc(forma)}(?!\\p{L})`, "iu").test(cuerpo);

(async () => {
  const j = await p.journey.findUnique({ where: { id: A1 } });
  const bundle = JSON.parse(fs.readFileSync("src/data/tapGlosses/spanish-traveler-latam.json", "utf8"));
  const enBundle = new Set<string>(bundle.slugs);
  const glosas = new Set(Object.keys(bundle.glosses).map((k) => k.toLowerCase()));
  const filas = await p.journeyStory.findMany({
    where: { journeyId: A1 },
    select: { id: true, slug: true, title: true, topic: true, slotIndex: true, text: true,
      vocab: true, audioUrl: true, coverUrl: true,
      practiceSet: { select: { exercises: { select: { id: true } } } } },
  });
  const orden = j!.topics;
  filas.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const cuerpos = filas.map((f) => `${f.title ?? ""} ${String(f.text ?? "")}`);

  console.log(`${j!.name} · ${j!.language}/${j!.variant} · ${j!.levels.join(",")} · ${j!.status}\n`);
  console.log("### Por temas\n");
  console.log("| # | Ciudad · Tema | Escritas+vocab | Glosas tap | Práctica | Audio | Cover |");
  console.log("|---|---|---|---|---|---|---|");
  const T = { esc: 0, glo: 0, pra: 0, aud: 0, cov: 0 };
  for (const [i, t] of orden.entries()) {
    const g = filas.filter((f) => f.topic === t);
    const c = {
      esc: g.filter((f) => f.text && ((f.vocab as unknown[]) ?? []).length >= 20).length,
      glo: g.filter((f) => f.slug && enBundle.has(f.slug)).length,
      pra: g.filter((f) => (f.practiceSet?.exercises.length ?? 0) > 0).length,
      aud: g.filter((f) => f.audioUrl).length,
      cov: g.filter((f) => f.coverUrl).length,
    };
    for (const k of Object.keys(T) as (keyof typeof T)[]) T[k] += c[k];
    console.log(`| ${i + 1} | ${CIUDAD[t] ?? "?"} · ${TEMA[t] ?? t} | ${c.esc}/3 | ${c.glo}/3 | ${c.pra}/3 | ${c.aud}/3 | ${c.cov}/3 |`);
  }
  console.log(`| | **journey** | **${T.esc}/21** | **${T.glo}/21** | **${T.pra}/21** | **${T.aud}/21** | **${T.cov}/21** |`);

  console.log("\n### Por historias\n");
  console.log("| # | Historia | Glosas | Portables | Ancladas | Vistas antes | Vuelven después | Escalera |");
  console.log("|---|---|---|---|---|---|---|---|");
  let gTot = 0, gCub = 0, port = 0, ancl = 0, antes = 0, desp = 0, sumaEnc = 0, plazas = 0;
  for (const [i, f] of filas.entries()) {
    const formas = new Set<string>();
    for (const m of `${f.title ?? ""} ${String(f.text ?? "")}`.matchAll(/\p{L}+(?:-\p{L}+)*/gu)) formas.add(m[0].toLowerCase());
    const cub = [...formas].filter((k) => glosas.has(k)).length;
    gTot += formas.size; gCub += cub;
    let pt = 0, an = 0, ant = 0, des = 0, enc = 0;
    for (const v of ((f.vocab as any[]) ?? [])) {
      const k = clave(v);
      const donde = cuerpos.map((c, n) => (sale(c, k) ? n : -1)).filter((n) => n >= 0);
      enc += donde.length; plazas++;
      donde.length > 1 ? pt++ : an++;
      if (donde.some((n) => n < i)) ant++;
      if (donde.some((n) => n > i)) des++;
    }
    port += pt; ancl += an; antes += ant; desp += des; sumaEnc += enc;
    const media = (enc / (((f.vocab as any[]) ?? []).length || 1)).toFixed(2);
    console.log(`| ${i + 1} | [${f.title}](http://localhost:3000/stories/${f.slug}) | ${cub}/${formas.size} | ${pt} | ${an} | ${ant} | ${des} | ${media} |`);
  }
  console.log(`| | **journey** | **${gCub}/${gTot}** | **${port}** | **${ancl}** | **${antes}** | **${desp}** | **${(sumaEnc / plazas).toFixed(2)}** |`);
  await p.$disconnect();
})();
