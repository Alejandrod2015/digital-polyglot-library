import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";

const SPEAKER_LABEL_REGEX = /^\s*([\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3})\s*:\s+(.*\S)\s*$/u;
function parseSegments(text: string) {
  const cleaned = text.replace(/<[^>]+>/g, " ");
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim());
  const segs: { speaker: string; text: string }[] = [];
  let buf: string[] = [];
  const flush = () => { if (buf.length) { const t = buf.join(" ").replace(/\s+/g, " ").trim(); if (t) segs.push({ speaker: "narrator", text: t }); buf = []; } };
  for (const l of lines) {
    if (!l) continue;
    const m = l.match(SPEAKER_LABEL_REGEX);
    if (m) { flush(); segs.push({ speaker: m[1].trim(), text: m[2].trim() }); }
    else buf.push(l);
  }
  flush();
  return segs;
}

// Fallback voices for A1-only minor characters not present in A2 (named bank, verified later).
const FALLBACK: Record<string, string> = {
  "tía lucha": "3ttovAt5bt3Kk38UGIob",   // alma (F middle LATAM neutral)
  rosa: "3ttovAt5bt3Kk38UGIob",          // alma; doña Rosa (Cartagena, mayor)
  vendedora: "3ttovAt5bt3Kk38UGIob",     // alma; one-off F (CDMX market)
  hombre: "57D8YIbQSuE3REDPO6Vm",        // horacio (M middle CO); gate stranger
  "don pedro": "DV9FrN0pQkPWIoxW5dvT",   // emilio (M middle MX); old man w/ lamp
};

(async () => {
  const apply = process.argv.includes("--apply");
  const all = await prisma.journeyStory.findMany({
    where: { journeyId: J, level: { in: ["a1", "a2"] } },
    select: { id: true, slug: true, level: true, topic: true, text: true, dialogueSpec: true, audioUrl: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  // Build per-topic map FROM A2 specs: speaker(lower) -> voice, + narrator voice
  const topicMap: Record<string, { narrator?: string; map: Record<string, string> }> = {};
  for (const s of all) {
    if (s.level !== "a2") continue;
    const spec = Array.isArray(s.dialogueSpec) ? (s.dialogueSpec as any[]) : [];
    if (!spec.length) continue;
    const tm = (topicMap[s.topic] ||= { map: {} });
    for (const seg of spec) {
      if (!seg?.voice || !seg?.speaker) continue;
      const key = String(seg.speaker).toLowerCase();
      if (key === "narrator") { tm.narrator ||= seg.voice; }
      else if (!tm.map[key]) tm.map[key] = seg.voice;
    }
  }

  console.log("=== Mapa derivado de A2 por tema ===");
  for (const [t, tm] of Object.entries(topicMap)) {
    console.log(`  ${t}: narrator=${tm.narrator} | ${Object.entries(tm.map).map(([k, v]) => `${k}->${v.slice(0, 6)}`).join(", ")}`);
  }

  console.log("\n=== A1: construir specs ===");
  const unknown = new Set<string>();
  for (const s of all) {
    if (s.level !== "a1" || !s.text) continue;
    if (s.audioUrl) { console.log(`  ${s.slug}: TIENE AUDIO; skip`); continue; }
    const tm = topicMap[s.topic] || { map: {} };
    const narratorVoice = tm.narrator;
    if (!narratorVoice) { console.log(`  !! ${s.slug}: tema ${s.topic} sin narrador A2`); continue; }
    const segs = parseSegments(s.text);
    const spec = segs.map((seg) => {
      const key = seg.speaker.toLowerCase();
      let voice: string | undefined;
      if (key === "narrator") voice = narratorVoice;
      else voice = tm.map[key] || FALLBACK[key];
      if (!voice) { unknown.add(`${s.slug}::${seg.speaker}`); voice = narratorVoice; }
      return { speaker: seg.speaker, text: seg.text, voice };
    });
    const speakers = [...new Set(spec.map((x) => x.speaker))];
    const fb = speakers.filter((x) => x.toLowerCase() !== "narrator" && !tm.map[x.toLowerCase()] && FALLBACK[x.toLowerCase()]);
    console.log(`  ${apply ? "WRITE" : "[dry]"} ${s.slug} (${spec.length} segs) speakers=${speakers.join(", ")}${fb.length ? `  [fallback: ${fb.join(", ")}]` : ""}`);
    if (apply) {
      await prisma.journeyStory.update({ where: { id: s.id }, data: { dialogueSpec: spec as any, voiceId: narratorVoice } });
    }
  }
  if (unknown.size) { console.log(`\n⚠ Speakers SIN voz (cayeron a narrator):`); unknown.forEach((u) => console.log(`  ${u}`)); }
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
