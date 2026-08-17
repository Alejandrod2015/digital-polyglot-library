import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as crypto from "crypto";
import { execFileSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { softenPunctuationForTts, DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODEL_V2, DIALOGUE_GAP_SEC, parseDialogueSegments } from "../src/lib/elevenlabs";

const J = "cmqp6hal8000032cb4ywfs0gc";
const SLUGS = ["no-hay-cafe", "se-fue-la-luz", "por-fin-se-abre-la-puerta", "una-caja-vieja", "mateo-trae-pan-dulce"];
const BASE = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/";

function segUrl(voiceId: string, text: string): string {
  const fp = JSON.stringify(DEFAULT_VOICE_SETTINGS);
  const h = crypto.createHash("sha256").update(`${voiceId}|${ELEVENLABS_MODEL_V2}|${fp}|${softenPunctuationForTts(text)}|trim-v7-noprev`).digest("hex").slice(0, 24);
  return `${BASE}media/multivoice-segments/${h}.mp3`;
}
const durOf = (u: string): number | null => { try { return parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", u], { encoding: "utf8" }).trim()); } catch { return null; } };
const titleToText = (t: string) => { const c = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); return c ? (/[.!?…:]$/.test(c) ? c : `${c}.`) : ""; };

(async () => {
  const p = new PrismaClient();
  for (const slug of SLUGS) {
    const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true, title: true, text: true, dialogueSpec: true } });
    if (!s?.text) { console.log(`!! ${slug}: sin texto`); continue; }
    const cur = (s.dialogueSpec as any[]) ?? [];
    const vm: Record<string, string> = {};
    for (const x of cur) if (x?.speaker && x?.voice) vm[String(x.speaker).toLowerCase()] = x.voice;
    const narrator = vm["narrator"];
    const segs = parseDialogueSegments(s.text);

    // 1) rebuild dialogueSpec: one entry per segment (incl. narrator), shape {text,voice,speaker} like sabado
    const newSpec = segs.map((sg) => ({ text: sg.text, voice: vm[sg.speaker.toLowerCase()] ?? narrator, speaker: sg.speaker }));

    // 2) fragments: title + segments, with cached urls + sum-method offsets
    type F = { text: string; voiceId: string; speaker: string };
    const frags: F[] = [];
    const tt = titleToText(s.title ?? "");
    if (tt) frags.push({ text: tt, voiceId: narrator, speaker: "narrator" });
    for (const sg of segs) frags.push({ text: sg.text, voiceId: vm[sg.speaker.toLowerCase()] ?? narrator, speaker: sg.speaker });

    const out: any[] = []; let cursor = 0, missing = 0;
    for (let i = 0; i < frags.length; i++) {
      const url = segUrl(frags[i].voiceId, frags[i].text);
      const d = durOf(url);
      if (d == null) { missing++; continue; }
      out.push({ index: i, speaker: frags[i].speaker, voiceId: frags[i].voiceId, startSec: Number(cursor.toFixed(3)), endSec: Number((cursor + d).toFixed(3)), url, text: frags[i].text });
      cursor = Number((cursor + d).toFixed(3)) + (i < frags.length - 1 ? DIALOGUE_GAP_SEC : 0);
    }
    if (missing) { console.log(`!! ${slug}: ${missing} segmento(s) no cacheado(s) -> ABORTO`); continue; }

    // 3) GUARD: fragments === dialogueSpec + 1 (lo que el editor espera para detectar el título)
    if (out.length !== newSpec.length + 1) { console.log(`!! ${slug}: fragments(${out.length}) !== spec(${newSpec.length})+1 -> ABORTO`); continue; }

    await p.journeyStory.update({ where: { id: s.id }, data: { dialogueSpec: newSpec as any, audioFragments: out as any } });
    console.log(`ok ${slug}: dialogueSpec ${cur.length}->${newSpec.length} | fragments ${out.length} (title + ${newSpec.length}) ✓`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
