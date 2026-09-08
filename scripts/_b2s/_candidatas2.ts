/** Candidatas al reves: recorre el LEXICO graduado por encima de A1/A2 y busca sus formas
 *  en el cuerpo (raiz de 5), descartando lo ya enseñado (lematizando los dos lados). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { SPANISH_B1_LEMMAS as SPANISH_B1 } from "../../src/lib/cefr/spanishB1";
import { SPANISH_B2_LEMMAS as SPANISH_B2 } from "../../src/lib/cefr/spanishB2";
const p = new PrismaClient();
const de = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const raiz = (w: string) => { const d = de(w); return d.replace(/(arse|erse|irse|ar|er|ir)$/, ""); };
const JID = process.argv[2], NIVEL = process.argv[3] as "b1" | "b2";
(async () => {
  const j = await p.journey.findUnique({ where: { id: JID }, select: { typeSlug: true } });
  const mismos = new Set((await p.journey.findMany({ where: { language: "spanish", typeSlug: j!.typeSlug }, select: { id: true } })).map((x) => x.id));
  const tipo = new Set<string>(), todo = new Set<string>();
  for (const o of await p.journey.findMany({ where: { language: "spanish" }, select: { id: true } }))
    for (const s of await p.journeyStory.findMany({ where: { journeyId: o.id }, select: { vocab: true } }))
      for (const v of ((s.vocab as any[]) ?? [])) { todo.add(de(String(v.word))); if (mismos.has(o.id)) tipo.add(de(String(v.word))); }
  const LEX = [...SPANISH_B1, ...(NIVEL === "b2" ? [...SPANISH_B2] : [])].filter((w) => !isSpanishUpToLevel(w, "a2") && !tipo.has(de(w)));
  const st = await p.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, topic: true, slotIndex: true, title: true, text: true, vocab: true } });
  const corpus = st.map((s) => de(`${s.title} ${s.text}`)).join("\n");
  for (const s of st) {
    const cuerpo = de(`${s.title} ${s.text}`);
    const tokens = new Set(cuerpo.match(/[a-z]+/g) ?? []);
    const v = (s.vocab as any[]) ?? [];
    const ya = new Set(v.flatMap((x) => [de(String(x.word)), de(String(x.surface ?? ""))]));
    const bajas = v.filter((x) => isSpanishUpToLevel(String(x.word), "a2"));
    const cand: string[] = [];
    for (const w of LEX) {
      if (ya.has(de(w))) continue;
      const r = raiz(w);
      if (r.length < 4) continue;
      const forma = [...tokens].find((t) => t === de(w) || (t.startsWith(r) && t.length - r.length <= 4));
      if (!forma) continue;
      const rec = (corpus.match(new RegExp(`(^|[^a-z])${r}`, "g")) ?? []).length;
      cand.push(`${w}${forma !== de(w) ? `~${forma}` : ""}(${rec})${todo.has(de(w)) ? "*" : ""}`);
    }
    console.log(`\n## ${s.topic}#${s.slotIndex} ${s.slug} · A1A2 ${bajas.length}/${v.length}`);
    console.log(`   BAJAS: ${bajas.map((x) => x.word).join(", ")}`);
    console.log(`   CAND : ${cand.join(" ")}`);
  }
  await p.$disconnect();
})();
