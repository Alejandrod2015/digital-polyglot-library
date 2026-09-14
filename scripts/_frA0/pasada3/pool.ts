// SOLO LECTURA. Pool de plazas nuevas para la palanca 2 sobre pasada3: palabras
// del texto en 2+ historias que no son plaza del journey, con su choque
// (tipo de journey, estado, tipo de palabra) contra el vocab frances ajeno.
// Y por historia: sus portables con encuentros y parrafo.
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
const ESTE = "cmtwo6cys0007j8yzg6ni3fsc";
const tok = (t: string) => (t.toLowerCase().replace(/’/g, "'").match(/[\p{L}'-]+/gu) ?? []).flatMap((w) => [w, ...w.split(/['-]/)]);
const STOP = new Set(("le la les un une des du de d l à au aux en dans sur sous avec pour par sans chez et ou mais donc puis alors là ici y " +
  "je j tu il elle on nous vous ils elles me m te t se s lui leur moi toi ce c ça cette ces cet qui que qu quoi où ne n pas plus non oui " +
  "très bien aussi tout tous toute est suis es sont être a as ai ont avoir fait faire va vais aller dit dire son sa ses mon ma mes ton ta tes " +
  "notre votre si comme même encore après avant quand léa hugo théo chloé maxime louise antoine clara marseille paris panier").split(" "));
(async () => {
  const st = ["t1","t2","t3","t4","t5","t6","t7"].flatMap((t) => JSON.parse(fs.readFileSync(`scripts/_frA0/pasada3/${t}.json`, "utf8")).map((s: any, i: number) => ({ ...s, id: `${t}#${i}` })));
  const art = (w: string) => w.toLowerCase().replace(/’/g, "'").replace(/^(le |la |les |l'|se |s')/, "").trim();
  const slots = new Set(st.flatMap((s: any) => s.vocab.flatMap((v: any) => [art(String(v.surface ?? v.word)), art(v.word)])));
  const otras: any[] = await p.journeyStory.findMany({ where: { journey: { language: "french" }, journeyId: { not: ESTE } }, select: { vocab: true, journey: { select: { status: true, typeSlug: true } } } as any });
  const fuera = new Map<string, string>();
  for (const s of otras) for (const v of (s.vocab ?? []) as any[]) for (const k of [art(String(v.word)), art(String(v.surface ?? v.word))])
    fuera.set(k, `${s.journey.typeSlug}/${s.journey.status}/${v.type}`);
  const cuerpos = st.map((s: any) => new Set(tok(s.text)));
  const donde = (w: string) => st.filter((_: any, i: number) => cuerpos[i].has(w)).map((s: any) => s.id);
  const pool = new Map<string, string[]>();
  cuerpos.forEach((c) => c.forEach((w) => { if (w.length > 2 && !STOP.has(w) && !slots.has(w) && !pool.has(w)) { const d = donde(w); if (d.length >= 2) pool.set(w, d); } }));
  console.log("POOL (n, palabra, choque, historias)");
  [...pool].sort((a, b) => b[1].length - a[1].length).forEach(([w, d]) => console.log(`${d.length} ${w.padEnd(14)} ${(fuera.get(w) ?? "-").padEnd(30)} ${d.join(" ")}`));
  console.log("\nPORTABLES CON 1-2 ENCUENTROS (historia, palabra/superficie, n, parrafo)");
  st.forEach((s: any, i: number) => {
    const pars = s.text.split("\n\n").map((x: string) => new Set(tok(x)));
    const out = s.vocab.filter((v: any) => !v.anchor).map((v: any) => {
      const k = art(String(v.surface ?? v.word));
      const n = k.includes(" ") ? st.filter((x: any) => x.text.toLowerCase().includes(k)).length : donde(k).length;
      return { k, n, par: pars.findIndex((x: Set<string>) => k.split(" ").every((q) => x.has(q))) + 1 };
    }).filter((o: any) => o.n <= 2);
    console.log(`${s.id} ${out.map((o: any) => `${o.k}(${o.n},p${o.par})`).join(" ")}`);
  });
  await p.$disconnect();
})();
