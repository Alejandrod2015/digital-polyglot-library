/** Techo REAL del suelo de nivel sin tocar texto: plazas altas actuales + palabras del lexico
 *  graduado por encima de A1/A2 cuya forma sale EXACTA (o plural) en el cuerpo y no estan enseñadas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { SPANISH_B1_LEMMAS } from "../../src/lib/cefr/spanishB1";
import { SPANISH_B2_LEMMAS } from "../../src/lib/cefr/spanishB2";
const p = new PrismaClient();
const de = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
(async () => {
  for (const [JID, NIVEL, tag] of [["cmt5x67ze000l320cpgunu5vi", "b1", "B1"], ["cmtplpfum0007j8c6piegwt31", "b2", "B2"]] as [string, "b1" | "b2", string][]) {
    const j = await p.journey.findUnique({ where: { id: JID }, select: { typeSlug: true } });
    const mismos = new Set((await p.journey.findMany({ where: { language: "spanish", typeSlug: j!.typeSlug }, select: { id: true } })).map((x) => x.id));
    const tipo = new Set<string>();
    for (const o of await p.journey.findMany({ where: { language: "spanish" }, select: { id: true } }))
      if (mismos.has(o.id) && o.id !== JID)
        for (const s of await p.journeyStory.findMany({ where: { journeyId: o.id }, select: { vocab: true } }))
          for (const v of ((s.vocab as any[]) ?? [])) tipo.add(de(String(v.word)));
    const LEX = [...SPANISH_B1_LEMMAS, ...(NIVEL === "b2" ? [...SPANISH_B2_LEMMAS] : [])].filter((w) => !isSpanishUpToLevel(w, "a2") && !tipo.has(de(w)));
    const st = await p.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, text: true, title: true, vocab: true } });
    let tot = 0, alto = 0, techo = 0;
    const detalle: string[] = [];
    for (const s of st) {
      const v = (s.vocab as any[]) ?? [];
      const altas = v.filter((x) => !isSpanishUpToLevel(String(x.word), "a2")).length;
      tot += v.length; alto += altas;
      const tokens = new Set(de(`${s.title} ${s.text}`).match(/[a-z]+/g) ?? []);
      const ya = new Set(v.flatMap((x) => [de(String(x.word)), de(String(x.surface ?? ""))]));
      const extra = LEX.filter((w) => !ya.has(de(w)) && (tokens.has(de(w)) || tokens.has(de(w) + "s") || tokens.has(de(w) + "es")));
      techo += Math.min(v.length, altas + extra.length);
      if (extra.length) detalle.push(`${s.slug}: +${extra.length} (${extra.slice(0, 6).join(", ")})`);
    }
    console.log(`\n### ${tag}: ahora ${alto}/${tot} = ${Math.round(100 * alto / tot)}% · TECHO exacto ${techo}/${tot} = ${Math.round(100 * techo / tot)}% · objetivo 60% = ${Math.ceil(0.6 * tot)}`);
    for (const d of detalle) console.log("   " + d);
  }
  await p.$disconnect();
})();
