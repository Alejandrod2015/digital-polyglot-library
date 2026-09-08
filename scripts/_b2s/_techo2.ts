/** Techo con UNICIDAD GLOBAL: cada candidata puede ocupar una sola plaza del journey.
 *  Formas: exacta, plural, y verbo por raiz con terminacion conjugada corta. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { SPANISH_B1_LEMMAS } from "../../src/lib/cefr/spanishB1";
import { SPANISH_B2_LEMMAS } from "../../src/lib/cefr/spanishB2";
const p = new PrismaClient();
const de = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const VERB = /(ar|er|ir|arse|erse|irse)$/;
const FIN = ["o","a","e","as","es","an","en","aba","ia","o","ado","ido","ando","iendo","aron","ieron","are","ere","ada","ido","amos","emos","imos"];
(async () => {
  for (const [JID, NIVEL, tag] of [["cmt5x67ze000l320cpgunu5vi", "b1", "B1"], ["cmtplpfum0007j8c6piegwt31", "b2", "B2"]] as [string, "b1" | "b2", string][]) {
    const j = await p.journey.findUnique({ where: { id: JID }, select: { typeSlug: true } });
    const mismos = new Set((await p.journey.findMany({ where: { language: "spanish", typeSlug: j!.typeSlug }, select: { id: true } })).map((x) => x.id));
    const tipo = new Set<string>();
    for (const o of await p.journey.findMany({ where: { language: "spanish" }, select: { id: true } }))
      if (mismos.has(o.id) && o.id !== JID)
        for (const s of await p.journeyStory.findMany({ where: { journeyId: o.id }, select: { vocab: true } }))
          for (const v of ((s.vocab as any[]) ?? [])) tipo.add(de(String(v.word)));
    const LEX = [...new Set([...SPANISH_B1_LEMMAS, ...(NIVEL === "b2" ? [...SPANISH_B2_LEMMAS] : [])].map(de))]
      .filter((w) => !isSpanishUpToLevel(w, "a2") && !tipo.has(w));
    const st = await p.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, text: true, title: true, vocab: true } });
    const yaJourney = new Set<string>();
    for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) { yaJourney.add(de(String(v.word))); yaJourney.add(de(String(v.surface ?? ""))); }
    let tot = 0, alto = 0;
    const porHistoria: { slug: string; huecos: number; cand: string[] }[] = [];
    const usada = new Set<string>();
    for (const s of st) {
      const v = (s.vocab as any[]) ?? [];
      const altas = v.filter((x) => !isSpanishUpToLevel(String(x.word), "a2")).length;
      tot += v.length; alto += altas;
      const tokens = new Set(de(`${s.title} ${s.text}`).match(/[a-z]+/g) ?? []);
      const cand = LEX.filter((w) => {
        if (yaJourney.has(w)) return false;
        if (tokens.has(w) || tokens.has(w + "s") || tokens.has(w + "es")) return true;
        if (!VERB.test(w)) return false;
        const r = w.replace(/(arse|erse|irse|ar|er|ir)$/, "");
        return r.length >= 4 && FIN.some((f) => tokens.has(r + f));
      });
      porHistoria.push({ slug: s.slug!, huecos: v.length - altas, cand });
    }
    // reparto: cada candidata a UNA sola historia, empezando por las que menos opciones tienen
    let ganadas = 0;
    for (const h of [...porHistoria].sort((a, b) => a.cand.length - b.cand.length)) {
      let puestas = 0;
      for (const w of h.cand) { if (usada.has(w) || puestas >= h.huecos) continue; usada.add(w); puestas++; }
      ganadas += puestas;
      if (puestas) console.log(`   ${h.slug}: +${puestas}`);
    }
    console.log(`### ${tag}: ahora ${alto}/${tot} ${Math.round(100 * alto / tot)}% · TECHO ${alto + ganadas}/${tot} = ${Math.round(100 * (alto + ganadas) / tot)}% · objetivo 60% (${Math.ceil(0.6 * tot)})\n`);
  }
  await p.$disconnect();
})();
