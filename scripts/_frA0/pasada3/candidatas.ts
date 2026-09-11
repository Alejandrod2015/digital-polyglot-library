// SOLO LECTURA. Para cada historia de pasada2: sus portables SUELTOS y las
// palabras de SU texto que podrian ser plaza: no son plaza ya en el journey,
// no son comodin, no estan en el vocab de otro journey frances (Expat,
// archivado) y salen en 3+ historias (la plaza nueva nace con 2+ encuentros).
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const STOP = new Set(("le la les un une des du de d l à au aux en dans sur sous avec pour par sans chez et ou mais donc puis alors là ici y " +
  "je j tu il elle on nous vous ils elles me m te t se s lui leur moi toi ce c ça cette ces cet qui que qu quoi où ne n pas plus non oui " +
  "très bien aussi tout tous toute est suis es sont être a as ai ont avoir fait faire va vais aller dit dire son sa ses mon ma mes ton ta tes " +
  "notre votre si comme même encore après avant quand léa hugo théo chloé maxime louise antoine clara marseille paris panier").split(" "));
(async () => {
  const st = ["t1","t2","t3","t4","t5","t6","t7"].flatMap((t) => JSON.parse(fs.readFileSync(`scripts/_frA0/pasada3/${t}.json`, "utf8")).map((s: any) => ({ ...s, tf: t })));
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(le|la|les|l'|l’)\s*/, "");
  const slotsJourney = new Set(st.flatMap((s: any) => s.vocab.flatMap((v: any) => [clave(v), String(v.word).toLowerCase().replace(/^(le|la|les|l'|l’)\s*/, "")])));
  const otras: any[] = await p.journeyStory.findMany({ where: { journey: { language: "french" }, journeyId: { not: "cmtwo6cys0007j8yzg6ni3fsc" } }, select: { vocab: true } as any });
  const fuera = new Set(otras.flatMap((s) => ((s.vocab ?? []) as any[]).map((v) => String(v.word).toLowerCase().replace(/^(le|la|les|l'|l’)\s*/, ""))));
  const cuerpos = st.map((s: any) => new Set(tok(s.text)));
  const n = (w: string) => cuerpos.filter((c) => c.has(w)).length;
  const enc = (v: any) => { const k = clave(v); return k.includes(" ") || !/^\p{L}+$/u.test(k) ? -1 : n(k); };
  st.forEach((s: any, i: number) => {
    const sueltos = s.vocab.filter((v: any) => !v.anchor && enc(v) === 1).map((v: any) => clave(v));
    if (!sueltos.length) return;
    const pars = s.text.split("\n\n");
    const cand = [...new Set(tok(s.text))].filter((w) => w.length > 2 && !STOP.has(w) && !slotsJourney.has(w) && n(w) >= 2)
      .map((w) => `${w}(${n(w)}${fuera.has(w) ? ",OTRO-JOURNEY" : ""},p${pars.findIndex((x: string) => tok(x).includes(w)) + 1})`);
    console.log(`${s.tf}#${s.slotIndex} ${s.title.slice(0, 22).padEnd(22)} sueltos: ${sueltos.join(", ")}\n      candidatas: ${cand.join(" ")}`);
  });
  await p.$disconnect();
})();
