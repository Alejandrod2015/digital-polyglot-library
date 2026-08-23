/**
 * Banco de pruebas del Traveler IT A1. Solo LEE: mide el borrador antes de
 * gastar una pasada del gate, y sobre todo mide lo que el gate de journey mide
 * (recirculacion, forma de apertura, formulas, cierres) que es lo unico que no
 * se puede arreglar historia a historia.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { ITALIAN_A1_A2_LEMMAS } from "../src/lib/cefr/italianA1A2";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
import { validateJourneyStories, type JourneyStoryInput } from "../src/lib/validateJourneyStories";

const prisma = new PrismaClient();
const OPEN = "“", CLOSE = "”";
const w = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];

function quotedPct(t: string) {
  let inside = 0;
  for (const m of t.matchAll(new RegExp(`${OPEN}([^${CLOSE}]*)${CLOSE}`, "g"))) inside += w(m[1]);
  return (inside / w(t)) * 100;
}

async function run() {
  const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
  stories.sort((a, b) => (TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const trav = "cmss0fkc40007j8dub1zpa1kc";
  const rows = await prisma.journeyStory.findMany({
    where: { journey: { language: "italian", status: { not: "archived" } } },
    select: { journeyId: true, vocab: true },
  });
  // Espeja la regla de `saveStory.ts`: del journey del MISMO tipo solo cuenta
  // como bloqueada la capa anclada; la portable (verbo, adjetivo, adverbio) es
  // justo la que la escalera quiere reencontrar en el nivel siguiente.
  const PORTABLE = new Set(["verb", "adjective", "adverb", "expression"]);
  const A0T = new Set<string>(), A0F = new Set<string>();
  for (const r of rows) for (const v of ((r.vocab as any[]) ?? [])) {
    if (PORTABLE.has(String(v.type ?? "").toLowerCase())) continue;
    (r.journeyId === trav ? A0T : A0F).add(String(v.word));
  }
  const L = ITALIAN_A1_A2_LEMMAS as Set<string>;

  // Superficies ensenadas en OTRAS historias que este cuerpo contiene: es lo
  // unico que mueve la escalera de recirculacion, y sin verlo por historia se
  // reescribe a ciegas.
  const tokAll = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerposAll = stories.map((s) => new Set(tokAll(s.text)));
  const supDe = new Map<string, number>();
  stories.forEach((s, i) => (s.vocab ?? []).forEach((v: any) => supDe.set(String(v.surface ?? v.word).toLowerCase(), i)));
  const ajenasDe = (i: number) => [...supDe].filter(([t, o]) => o !== i && cuerposAll[i].has(t)).length;
  console.log("hist  tema                        pal  fra blq cit%  voc  aje  bloques         avisos");
  const taught = new Map<string, string[]>();
  let problemas = 0;
  for (const s of stories) {
    const blocks = renderedParagraphs(s.text);
    const sent = blocks.reduce((n, b) => n + b.split(/(?<=[.!?”])\s+/).filter(Boolean).length, 0);
    const voc = (s.vocab ?? []) as any[];
    const perBlock = blocks.map((b) => voc.filter((v) => b.includes(v.surface ?? v.word)).length);
    const bad = voc.filter((v) => A0T.has(v.word)).map((v) => v.word);
    const soft = voc.filter((v) => !A0T.has(v.word) && A0F.has(v.word)).map((v) => v.word);
    const off = voc.filter((v) => !L.has(String(v.word).toLowerCase())).map((v) => v.word);
    const roots = new Map<string, string[]>();
    for (const v of voc) { const r = String(v.word).slice(0, 5); if (r.length < 3) continue; roots.set(r, [...(roots.get(r) ?? []), v.word]); }
    const dupr = [...roots.values()].filter((a) => a.length > 1);
    for (const v of voc) taught.set(String(v.word), [...(taught.get(String(v.word)) ?? []), s.slug]);
    const words = w(s.text), q = quotedPct(s.text), ceil = Math.max(25, Math.round(words / 9));
    const flags: string[] = [];
    if (words < 115 || words > 170) flags.push(`PAL ${words}`);
    if (q < 25 || q > 35) flags.push(`CIT ${q.toFixed(0)}%`);
    if (voc.length < 20 || voc.length > ceil) flags.push(`VOC ${voc.length}/${ceil}`);
    if (perBlock.some((n) => n === 0)) flags.push("BLOQUE VACIO");
    if (voc.length && Math.max(...perBlock) / voc.length > 0.3) flags.push(`CONC ${Math.max(...perBlock)}`);
    if (bad.length) flags.push(`A0:${bad.join(",")}`);
    if (soft.length > 2) flags.push(`OTRO:${soft.join(",")}`);
    if (off.length > 2) flags.push(`FUERA:${off.join(",")}`);
    if (dupr.length) flags.push(`RAIZ:${dupr.map((a) => a.join("+")).join(" ")}`);
    if (/[\u00AB\u00BB\u201E"]/.test(s.text)) flags.push("COMILLAS");
    if (/[\u2014\u2013]/.test(s.text)) flags.push("GUION LARGO");
    for (const v of voc) {
      if (!s.text.toLowerCase().includes(String(v.surface ?? v.word).toLowerCase())) flags.push(`NO EN CUERPO: ${v.surface ?? v.word}`);
      const dw = w(String(v.definition ?? ""));
      if (dw < 8 || dw > 14) flags.push(`DEF ${v.word} ${dw}p`);
      if (String(v.definition ?? "").length > 120) flags.push(`DEF LARGA ${v.word}`);
    }
    if (flags.length) problemas++;
    console.log(
      `${String(s.slotIndex)}  ${String(s.topic).padEnd(26)} ${String(words).padStart(4)} ${String(sent).padStart(3)} ${String(blocks.length).padStart(3)} ${q.toFixed(0).padStart(4)} ${String(voc.length).padStart(4)} ${String(ajenasDe(stories.indexOf(s))).padStart(4)}  [${perBlock.join(",")}]`.padEnd(95) +
      (flags.length ? "  ← " + flags.join(" · ") : "  ok")
    );
  }
  const repes = [...taught].filter(([, v]) => v.length > 1);
  if (repes.length) console.log(`\nENSENADA DOS VECES (${repes.length}): ${repes.map(([k, v]) => `${k}(${v.length})`).join(", ")}`);
  {
    const clave = (v: any) => String(v.surface ?? v.word).toLowerCase();
    const enc = stories.flatMap((s) => (s.vocab ?? []).map((v: any) => cuerposAll.filter((c) => c.has(clave(v))).length));
    const media = enc.reduce((a, b) => a + b, 0) / (enc.length || 1);
    console.log(`\nESCALERA: media ${media.toFixed(2)} sobre ${enc.length} plazas (suelo A1 2.5) · faltan ${Math.max(0, Math.ceil(2.5 * enc.length - enc.reduce((a, b) => a + b, 0)))} apariciones`);
  }
  console.log(`\ntotal ${stories.length} historias · ${[...taught.keys()].length} palabras distintas ensenadas · ${problemas} con avisos`);

  if (stories.length >= 7) {
    const todas: JourneyStoryInput[] = stories.map((s) => ({ slug: s.slug, title: s.title, text: s.text, vocab: s.vocab, language: "italian", level: "a1" }));
    const realPeople = (await prisma.betaSignup.findMany({ select: { email: true } }))
      .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/)).filter((x) => x.length >= 3)
      .map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase());
    console.log("\n── gate de journey ──");
    for (const c of validateJourneyStories(todas, { language: "italian", level: "a1", realPeople }))
      console.log(`   ${c.status === "pass" ? "ok  " : c.status === "fail" ? "FAIL" : "SIN IMPL"} [${c.id}] ${c.detail ?? ""}`);
  }
  await prisma.$disconnect();
}
run();
