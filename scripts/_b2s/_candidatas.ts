/** Candidatas para subir el suelo de nivel: palabras del CUERPO, por encima de A1/A2,
 *  no enseñadas por ningun Traveler ES (lematizando los dos lados), dentro del lexico
 *  graduado del nivel, con su recirculacion en el journey. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const p = new PrismaClient();
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const JID = process.argv[2];
const NIVEL = (process.argv[3] ?? "b1") as "b1" | "b2";
(async () => {
  const j = await p.journey.findUnique({ where: { id: JID }, select: { typeSlug: true, language: true } });
  const mismoTipo = await p.journey.findMany({ where: { language: "spanish", typeSlug: j!.typeSlug }, select: { id: true } });
  const otros = await p.journey.findMany({ where: { language: "spanish" }, select: { id: true } });
  const ensenadasTipo = new Set<string>(), ensenadasTodo = new Set<string>();
  for (const o of otros) {
    const esMismoTipo = mismoTipo.some((m) => m.id === o.id);
    for (const s of await p.journeyStory.findMany({ where: { journeyId: o.id }, select: { vocab: true } }))
      for (const v of ((s.vocab as any[]) ?? [])) {
        ensenadasTodo.add(lema(String(v.word)));
        if (esMismoTipo) ensenadasTipo.add(lema(String(v.word)));
      }
  }
  const st = await p.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, topic: true, slotIndex: true, title: true, text: true, vocab: true } });
  const corpus = st.map((s) => `${s.title} ${s.text}`.toLowerCase()).join("\n");
  const cuenta = (w: string) => (corpus.match(new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "giu")) ?? []).length;
  for (const s of st) {
    const v = (s.vocab as any[]) ?? [];
    const bajas = v.filter((x) => isSpanishUpToLevel(String(x.word), "a2"));
    const palabras = new Set((`${s.title} ${s.text}`.toLowerCase().match(/[\p{L}]+/gu) ?? []).filter((w) => w.length > 3));
    const cand: string[] = [];
    for (const w of palabras) {
      if (isSpanishUpToLevel(w, "a2")) continue;
      if (!isSpanishUpToLevel(w, NIVEL)) continue;           // dentro del lexico graduado (worth-teaching)
      if (ensenadasTipo.has(lema(w))) continue;
      if (v.some((x) => lema(String(x.word)) === lema(w) || lema(String(x.surface ?? "")) === lema(w))) continue;
      cand.push(`${w}(${cuenta(w)})${ensenadasTodo.has(lema(w)) ? "*" : ""}`);
    }
    console.log(`\n## ${s.topic}#${s.slotIndex} ${s.slug} · bajas ${bajas.length}/${v.length}`);
    console.log(`   BAJAS: ${bajas.map((x) => `${x.word}[${x.type}]`).join(", ")}`);
    console.log(`   CAND : ${cand.sort().join(" ")}`);
  }
  await p.$disconnect();
})();
