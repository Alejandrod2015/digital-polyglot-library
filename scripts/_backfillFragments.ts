import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as crypto from "crypto";
import { execFileSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { softenPunctuationForTts, DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODEL_V2, DIALOGUE_GAP_SEC, parseDialogueSegments } from "../src/lib/elevenlabs";

const J = "cmqp6hal8000032cb4ywfs0gc";
const BASE = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/";

function segPath(voiceId: string, text: string): string {
  const softened = softenPunctuationForTts(text);
  const fp = JSON.stringify(DEFAULT_VOICE_SETTINGS);
  const h = crypto.createHash("sha256").update(`${voiceId}|${ELEVENLABS_MODEL_V2}|${fp}|${softened}|trim-v7-noprev`).digest("hex").slice(0, 24);
  return `media/multivoice-segments/${h}.mp3`;
}
function durOf(url: string): number | null {
  try { return parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url], { encoding: "utf8" }).trim()); }
  catch { return null; }
}
function titleToText(t: string): string {
  const c = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return c ? (/[.!?…:]$/.test(c) ? c : `${c}.`) : "";
}

(async () => {
  const p = new PrismaClient();
  const rows = await p.journeyStory.findMany({
    where: { journeyId: J, audioUrl: { not: null } },
    select: { id: true, slug: true, title: true, text: true, dialogueSpec: true, audioFragments: true },
  });
  const todo = rows.filter((r) => !Array.isArray((r as any).audioFragments) || (r as any).audioFragments.length === 0);
  console.log(`Historias con audio y SIN fragments: ${todo.length}\n`);
  for (const s of todo) {
    if (!s.text) { console.log(`!! ${s.slug}: sin texto`); continue; }
    const spec = (s.dialogueSpec as any[]) ?? [];
    const vm: Record<string, string> = {};
    for (const x of spec) if (x?.speaker && x?.voice) vm[String(x.speaker).toLowerCase()] = x.voice;
    const narrator = vm["narrator"];

    type F = { text: string; voiceId: string; speaker: string };
    const frags: F[] = [];
    const tt = titleToText(s.title ?? "");
    if (tt) frags.push({ text: tt, voiceId: narrator, speaker: "narrator" });
    for (const seg of parseDialogueSegments(s.text)) frags.push({ text: seg.text, voiceId: vm[seg.speaker.toLowerCase()] ?? narrator, speaker: seg.speaker });

    const out: any[] = [];
    let cursor = 0, missing = 0;
    for (let i = 0; i < frags.length; i++) {
      const path = segPath(frags[i].voiceId, frags[i].text);
      const url = BASE + path;
      const d = durOf(url);
      if (d == null) { missing++; console.log(`   miss [${i}] «${frags[i].text.slice(0, 38)}»`); continue; }
      const start = Number(cursor.toFixed(3)), end = Number((cursor + d).toFixed(3));
      out.push({ index: i, speaker: frags[i].speaker, voiceId: frags[i].voiceId, startSec: start, endSec: end, url, text: frags[i].text });
      cursor = end + (i < frags.length - 1 ? DIALOGUE_GAP_SEC : 0);
    }
    if (missing) { console.log(`!! ${s.slug}: ${missing} segmento(s) no cacheado(s) -> NO guardo (parcial)`); continue; }
    await p.journeyStory.update({ where: { id: s.id }, data: { audioFragments: out as any } });
    console.log(`ok ${s.slug}: ${out.length} fragments guardados`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
