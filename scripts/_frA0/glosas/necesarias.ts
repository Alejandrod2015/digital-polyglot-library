// SOLO LECTURA. Lo que rebuildTapGlosses pediria para french-friends-a0, con la
// copia hermana que tomaria (si pasa citaAjena) y TODAS las frases donde sale
// cada palabra, para glosar mirando la frase y revisar las copias.
//   npx tsx scripts/_frA0/glosas/necesarias.ts > scripts/_frA0/glosas/necesarias.json
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../../src/generated/prisma";
import { extractStoryPlainText } from "../../../src/lib/storyPlainText";
import { TAPPABLE, glossKeyCandidates } from "../../../src/lib/tapGlossKey";
const p = new PrismaClient();
const B = "french-friends-a0", HERMANOS = ["french-traveler", "french-expat-lyon"];
const INGLES = new Set("the a an of to in on for and or is it that you he she his her its verb noun adjective adverb form past plural singular subjunctive imperative literally also as if were from with meaning feminine masculine name city street informal slang polite tool cutting".split(" "));
const frag = (g: string) => { const o: string[] = []; for (const m of g.matchAll(/\(([^)]+)\)/g)) o.push(m[1]); for (const t of g.split(";")) { const c = t.indexOf(","); if (c > 0) o.push(t.slice(0, c)); } return o.map((t) => t.trim().toLowerCase()).filter((t) => t.split(/\s+/).length >= 2); };
const citaAjena = (g: string, corpus: string) => frag(g).some((f) => !f.split(/[^\p{L}]+/u).filter(Boolean).some((w) => INGLES.has(w)) && !corpus.includes(f));
const exige = (tok: string) => { const c = glossKeyCandidates(tok); if (c.length < 3) return { exige: c[0] ?? "", valen: c.slice(0, 1) }; const carne = c[1].length >= 3 ? c[1] : c[2]; return { exige: carne, valen: [c[0], carne] }; };
(async () => {
  const ex = JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles[B];
  const exento = new Set([...ex.articles, ...ex.numerals, ...ex.characterNames, ...(ex.placeNames ?? [])].map((w: string) => w.toLowerCase()));
  const filas = await p.tapGlossSet.findMany({ where: { slug: "", bundle: { in: [B, ...HERMANOS] } }, select: { bundle: true, slugs: true, glosses: true } });
  const propio = filas.find((f) => f.bundle === B)!;
  const own = new Set(Object.keys(propio.glosses as object).map((k) => k.toLowerCase()));
  const hermano = new Map<string, any>();
  for (const h of HERMANOS) for (const [k, v] of Object.entries((filas.find((f) => f.bundle === h)?.glosses ?? {}) as Record<string, any>)) if (!hermano.has(k.toLowerCase())) hermano.set(k.toLowerCase(), { ...v, de: h });
  const st = await p.journeyStory.findMany({ where: { slug: { in: propio.slugs } }, select: { slug: true, title: true, text: true, topic: true, slotIndex: true } });
  st.sort((a, b) => propio.slugs.indexOf(a.slug!) - propio.slugs.indexOf(b.slug!));
  const corpus = st.map((s) => `${s.title ?? ""} ${extractStoryPlainText(s.text ?? "")}`).join(" ").toLowerCase();
  const out: Record<string, { copia: any; frases: string[] }> = {};
  for (const s of st) {
    const cuerpo = extractStoryPlainText(s.text ?? "");
    const frases = [s.title ?? "", ...cuerpo.split(/(?<=[.!?”])\s+|\n+/)].filter(Boolean);
    for (const f of frases) for (const tok of f.match(TAPPABLE) ?? []) {
      const { exige: k, valen } = exige(tok);
      if (!k || valen.some((v) => own.has(v) || exento.has(v))) continue;
      const e = out[k] ?? (out[k] = { copia: null, frases: [] });
      const h = hermano.get(k);
      if (h && !citaAjena(h.g, corpus)) e.copia = h;
      const tag = `${s.slug}: ${f.trim()}`;
      if (!e.frases.includes(tag) && e.frases.length < 6) e.frases.push(tag);
    }
  }
  const n = Object.values(out); console.error(`${n.length} claves · ${n.filter((e) => e.copia).length} con copia · ${n.filter((e) => !e.copia).length} nuevas`);
  console.log(JSON.stringify(out, null, 1));
  await p.$disconnect();
})();
