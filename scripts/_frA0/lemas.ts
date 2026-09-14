// SOLO LECTURA. Cuanto subiria la escalera si una plaza portable contara sus
// formas flexionadas. Tres medidas sobre pasada2 y pasada3:
//  literal: superficie literal (lo que mide hoy el checker);
//  glosas:  formas de la tabla `f` de las glosas francesas de la base (Expat);
//  prefijo: el emparejador por prefijo de vocabSurfaceValidation (>=60%).
//   npx tsx scripts/_frA0/lemas.ts
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => t.toLowerCase().replace(/’/g, "'").match(/\p{L}+/gu) ?? [];
const art = (w: string) => w.toLowerCase().replace(/’/g, "'").replace(/^(le |la |les |l'|se |s'|avoir |être )/, "").trim();
const PRON = new Set("je j tu il elle on nous vous ils elles ce c ça qui que".split(" "));
(async () => {
  // Tabla de formas desde las glosas
  const sets: any[] = await (p as any).tapGlossSet.findMany({ where: { language: "french" }, select: { glosses: true } });
  const formas = new Map<string, Set<string>>();
  let conF = 0;
  for (const s of sets) for (const [k, g] of Object.entries((s.glosses ?? {}) as Record<string, any>)) {
    if (!g?.f?.rows) continue;
    conF++;
    const lema = art(String(g.f.lemma ?? k));
    const f = formas.get(lema) ?? new Set<string>([lema]);
    f.add(art(k));
    for (const row of g.f.rows) for (const cel of row) for (const w of tok(String(cel))) if (!PRON.has(w)) f.add(w);
    formas.set(lema, f);
  }
  console.log(`glosas fr: ${sets.length} conjuntos, ${conF} entradas con formas, ${formas.size} lemas con tabla`);
  for (const dir of ["scripts/_frA0/pasada2", "scripts/_frA0/pasada3"]) {
    const st = ["t1","t2","t3","t4","t5","t6","t7"].flatMap((t) => JSON.parse(fs.readFileSync(`${dir}/${t}.json`, "utf8")));
    const cuerpos = st.map((s: any) => new Set(tok(s.text)));
    const low = st.map((s: any) => s.text.toLowerCase().replace(/’/g, "'"));
    const res: Record<string, number[]> = { literal: [], glosas: [], prefijo: [] };
    const cubiertos = { glosas: 0 }; const ejemplosPref: string[] = [];
    for (const s of st) for (const v of s.vocab) {
      if (v.anchor) continue;
      const sf = art(String(v.surface ?? v.word)); const lema = art(String(v.word));
      const multi = sf.includes(" ") || !/^\p{L}+$/u.test(sf);
      const lit = multi ? low.filter((t: string) => t.includes(sf)).length : cuerpos.filter((c) => c.has(sf)).length;
      res.literal.push(lit);
      if (multi) { res.glosas.push(lit); res.prefijo.push(lit); continue; }
      const fs_ = formas.get(lema); if (fs_) cubiertos.glosas++;
      const set = new Set([sf, ...(fs_ ?? [])]);
      res.glosas.push(cuerpos.filter((c) => [...set].some((w) => c.has(w))).length);
      // prefijo: comparte >=60% del lema (o de la superficie) como prefijo, minimo 3 letras
      const pref = (w: string, base: string) => { let i = 0; while (i < w.length && i < base.length && w[i] === base[i]) i++; return i >= 3 && i / base.length >= 0.6; };
      const casa = (c: Set<string>) => [...c].some((w) => w === sf || pref(w, lema.replace(/(er|ir|re|oir)$/, "")) && v.type === "verb" || (v.type !== "verb" && pref(w, sf) && Math.abs(w.length - sf.length) <= 2));
      const n = cuerpos.filter(casa).length; res.prefijo.push(n);
      if (n > lit && ejemplosPref.length < 400) ejemplosPref.push(`${lema}:${[...new Set(cuerpos.flatMap((c) => [...c].filter((w) => w !== sf && (v.type === "verb" ? pref(w, lema.replace(/(er|ir|re|oir)$/, "")) : pref(w, sf) && Math.abs(w.length - sf.length) <= 2))))].join("/")}`);
    }
    for (const [k, a] of Object.entries(res)) console.log(`${dir.split("/").pop()} ${k.padEnd(8)} suma ${a.reduce((x, y) => x + y, 0)} · media ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3)} · sueltos ${a.filter((n) => n <= 1).length}`);
    console.log(`   plazas simples con tabla en glosas: ${cubiertos.glosas}`);
    if (dir.endsWith("pasada2")) console.log("   prefijo, formas nuevas que casa:\n   " + ejemplosPref.join("\n   "));
  }
  await p.$disconnect();
})();
