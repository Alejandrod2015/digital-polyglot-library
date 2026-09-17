/** Candidatas a plaza: nivel, choque por lema con las plazas del journey y en
 *  cuantos cuerpos (base + ficheros) aparece alguna forma. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { formasDeVerbo } from "../../src/lib/cefr/spanishConjugations";
const p = new PrismaClient();
const nivel = (w: string) => (["a2", "b1", "b2", "c1"] as const).find((l) => isSpanishUpToLevel(w, l)) ?? "fuera";
(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { topic: true, slotIndex: true, slug: true, text: true, vocab: true } });
  const nuevo = new Map([1,2,3,4,5,6,7].flatMap((t) => (JSON.parse(fs.readFileSync(`scripts/_b2/t${t}.json`, "utf8")) as any[]).map((s) => [`${s.topic}#${s.slotIndex}`, s] as const)));
  const set = rows.map((r) => nuevo.get(`${r.topic}#${r.slotIndex}`) ?? r) as any[];
  const plazas = new Map<string, string>();
  for (const s of set) for (const v of s.vocab ?? []) plazas.set(String(v.word).toLowerCase().replace(/se$/, ""), s.slug);
  const cuerpos = set.map((s) => new Set(String(s.text).toLowerCase().match(/[\p{L}]+/gu) ?? []));
  for (const c of process.argv.slice(2)) {
    const base = c.replace(/se$/, "");
    const formas = new Set([c, ...(formasDeVerbo(base) ?? []), ...(formasDeVerbo(c) ?? [])]);
    const n = cuerpos.filter((cu) => [...formas].some((f) => cu.has(f))).length;
    console.log(`${c.padEnd(12)} nivel ${nivel(base).padEnd(5)} · plaza ya: ${plazas.get(base) ?? "no"} · en ${n} cuerpos`);
  }
  await p.$disconnect();
})();
