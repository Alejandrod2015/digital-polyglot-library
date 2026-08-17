import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as crypto from "crypto";
import { execFileSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { softenPunctuationForTts, DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODEL_V2, DIALOGUE_GAP_SEC, parseDialogueSegments } from "../src/lib/elevenlabs";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

const J = "cmqp6hal8000032cb4ywfs0gc";
const SLUGS = ["sabado-de-mercado", "no-hay-cafe", "mateo-trae-pan-dulce", "se-fue-la-luz"];
const BASE = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/";

// exact replica of multivoiceSegmentCacheKey (v2, no settings override, disableStitching=true)
function segUrl(voiceId: string, text: string): string {
  const softened = softenPunctuationForTts(text);
  const fp = JSON.stringify(DEFAULT_VOICE_SETTINGS);
  const h = crypto.createHash("sha256").update(`${voiceId}|${ELEVENLABS_MODEL_V2}|${fp}|${softened}|trim-v7-noprev`).digest("hex").slice(0, 24);
  return `${BASE}media/multivoice-segments/${h}.mp3`;
}
function dur(url: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url], { encoding: "utf8" });
  return parseFloat(out.trim());
}
function titleToText(t: string): string {
  const c = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return c ? (/[.!?…:]$/.test(c) ? c : `${c}.`) : "";
}

(async () => {
  const p = new PrismaClient();
  for (const slug of SLUGS) {
    const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true, title: true, text: true, dialogueSpec: true, audioFilename: true, ambientTag: true } });
    if (!s?.text || !s.audioFilename) { console.log(`!! ${slug}: incompleto`); continue; }
    const spec = (s.dialogueSpec as any[]) ?? [];
    const vm: Record<string, string> = {};
    for (const x of spec) if (x?.speaker && x?.voice) vm[String(x.speaker).toLowerCase()] = x.voice;
    const narrator = vm["narrator"];

    type F = { text: string; voiceId: string; speaker: string };
    const frags: F[] = [];
    const tt = titleToText(s.title ?? "");
    if (tt) frags.push({ text: tt, voiceId: narrator, speaker: "narrator" });
    for (const seg of parseDialogueSegments(s.text)) frags.push({ text: seg.text, voiceId: vm[seg.speaker.toLowerCase()] ?? narrator, speaker: seg.speaker });

    // exact offsets from cached segment durations
    const off: [number, number][] = [];
    let cursor = 0, missing = 0;
    for (let i = 0; i < frags.length; i++) {
      let d: number;
      try { d = dur(segUrl(frags[i].voiceId, frags[i].text)); } catch { missing++; console.log(`   miss seg [${i}] «${frags[i].text.slice(0, 40)}»`); break; }
      const start = cursor, end = cursor + d;
      if (frags[i].speaker.toLowerCase() === "narrator") {
        const last = off[off.length - 1];
        if (last && start - last[1] <= 0.5) last[1] = end; else off.push([start, end]);
      }
      cursor = end + (i < frags.length - 1 ? DIALOGUE_GAP_SEC : 0);
    }
    if (missing) { console.log(`!! ${slug}: ${missing} segmento(s) no cacheado(s) -> clave mal, ABORTO`); continue; }

    const dryName = s.audioFilename.replace(/\.mp3$/, "").replace(/_atempo[\d.]+_\d+$/, "") + ".mp3";
    const dryUrl = BASE + "media/generated/audio/" + dryName;
    let dryDur = 0; try { dryDur = dur(dryUrl); } catch { console.log(`!! ${slug}: dry no medible`); continue; }
    const diff = Math.abs(cursor - dryDur);
    console.log(`${slug}: reconstruido ${cursor.toFixed(2)}s vs dry ${dryDur.toFixed(2)}s (Δ${diff.toFixed(2)}) | OFF narrador: ${off.length}`);
    if (diff > 0.4) { console.log(`   ⚠ Δ>0.4s -> reconstrucción dudosa, ABORTO ${slug}`); continue; }

    const pp = await applyNarrationPostProcess({ storyId: s.id, sourceUrl: dryUrl, tempo: 1.0, narratorOffIntervals: off });
    console.log(`   ok re-mezclado: ${pp.audioFilename}`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
