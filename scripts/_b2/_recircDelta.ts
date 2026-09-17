/** Que plazas portables pierden encuentros al sustituir un tema por su version
 *  en fichero. Misma medicion que journey-vocab-recirculation (validateJourneyStories):
 *  palabra suelta = token exacto de la superficie; expresion = subcadena. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
const tok = (t: string) => new Set(t.toLowerCase().match(/[\p{L}]+/gu) ?? []);
(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true } });
  const nuevo = new Map((JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[]).map((s) => [`${s.topic}#${s.slotIndex}`, s]));
  const antes = rows.map((r) => ({ text: r.text ?? "", vocab: (r.vocab ?? []) as any[] }));
  const despues = rows.map((r) => { const n = nuevo.get(`${r.topic}#${r.slotIndex}`); return n ? { text: n.text, vocab: n.vocab } : { text: r.text ?? "", vocab: (r.vocab ?? []) as any[] }; });
  const mide = (set: typeof antes) => {
    const cuerpos = set.map((s) => tok(s.text)); const textos = set.map((s) => s.text.toLowerCase());
    const out = new Map<string, number>();
    for (const s of set) for (const v of s.vocab) {
      if (!PORT.has(String(v.type)) || v.anchor) continue;
      const k = String(v.surface ?? v.word).toLowerCase().replace(/^(el|la)\s+/, "");
      const n = k.includes(" ") ? textos.filter((t) => t.includes(k) || t.includes(String(v.word).toLowerCase())).length : cuerpos.filter((c) => c.has(k)).length;
      out.set(`${v.word} [${k}]`, n);
    }
    return out;
  };
  const a = mide(antes), d = mide(despues);
  const unaA = [...a.values()].filter((n) => n <= 1).length, unaD = [...d.values()].filter((n) => n <= 1).length;
  console.log(`cola: antes ${unaA}/${a.size} (${Math.round(100 * unaA / a.size)}%) · despues ${unaD}/${d.size} (${Math.round(100 * unaD / d.size)}%)`);
  const bajan = [...a.entries()].filter(([k, n]) => n >= 2 && (d.get(k) ?? n) <= 1).map(([k, n]) => `${k} ${n}->${d.get(k)}`);
  const nuevas = [...d.entries()].filter(([k]) => !a.has(k)).map(([k, n]) => `${k} ${n}`);
  console.log(`caen a un encuentro (${bajan.length}): ${bajan.join(" · ")}`);
  console.log(`superficies nuevas (${nuevas.length}): ${nuevas.join(" · ")}`);
  await p.$disconnect();
})();
