import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio, parseDialogueSegments } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { multiVoiceGuardError } from "../src/lib/multiVoiceGuard";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

const J = "cmqp6hal8000032cb4ywfs0gc";
const SLUG = process.argv[2];
const AMBIENT = process.argv[3] && process.argv[3] !== "none" ? process.argv[3] : null; // "none" o vacío = sin ambiente

(async () => {
  if (!SLUG) throw new Error("usage: _genStoryClean.ts <slug> [ambientTag|none]");
  const p = new PrismaClient();
  const story = await p.journeyStory.findFirst({ where: { journeyId: J, slug: SLUG }, include: { journey: true } });
  if (!story?.text || !story.title) throw new Error("no text/title");

  // voiceMap desde el dialogueSpec actual
  const cur = (story.dialogueSpec as any[]) ?? [];
  const vm: Record<string, string> = {};
  for (const x of cur) if (x?.speaker && x?.voice) vm[String(x.speaker).toLowerCase()] = x.voice;
  const narrator = vm["narrator"];
  const segs = parseDialogueSegments(story.text);

  // dialogueSpec por-segmento (incluye narrador) -> dialogueSpec.length === fragments-1 (editor OK)
  const newSpec = segs.map((sg) => ({ text: sg.text, voice: vm[sg.speaker.toLowerCase()] ?? narrator, speaker: sg.speaker }));
  await p.journeyStory.update({ where: { id: story.id }, data: { dialogueSpec: newSpec as any, ambientTag: AMBIENT } });

  const g = multiVoiceGuardError({ storyText: story.text, dialogueSpec: newSpec });
  if (g) throw new Error("GUARD: " + g);

  console.log(`generando ${SLUG} | voces: ${Object.keys(vm).join(", ")} | ambiente: ${AMBIENT ?? "ninguno"}`);
  await p.journeyStory.update({ where: { id: story.id }, data: { audioStatus: "generating" } });

  const r = await generateAndUploadMultiVoiceAudio({
    storyText: story.text, title: story.title,
    voiceMap: Object.fromEntries(newSpec.map((s) => [s.speaker.toLowerCase(), s.voice])),
    language: story.journey.language ?? undefined, disableStitching: true,
    normalizePerSegment: true,
  });
  if (!r) throw new Error("multi-voice null");
  await p.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: r.url, audioSegments: r.audioSegments as any, audioFragments: r.fragments as any,
      audioFilename: r.filename, audioStatus: "ready",
      voiceId: r.speakerVoiceMap?.narrator ?? narrator ?? null,
      audioQaStatus: r.audioQa?.status ?? null, audioQaScore: r.audioQa?.score ?? null,
    },
  });
  await generateWordTimingsForStory(story.id);

  // ambiente (si se pidió) con ducking padded; si no, queda seco
  if (AMBIENT) {
    const { computeNarratorOffIntervals } = await import("../src/lib/narrationPostProcess");
    const fresh = await p.journeyStory.findUnique({ where: { id: story.id }, select: { text: true, audioSegments: true, audioUrl: true } });
    const { intervals } = computeNarratorOffIntervals(fresh!.text ?? "", fresh!.audioSegments);
    const PAD = 0.6;
    const padded = intervals.map(([a, b]) => [Math.max(0, a - PAD), b + PAD] as [number, number]).sort((x, y) => x[0] - y[0])
      .reduce((acc: [number, number][], iv) => { const l = acc[acc.length - 1]; if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]); else acc.push(iv); return acc; }, []);
    const pp = await applyNarrationPostProcess({ storyId: story.id, sourceUrl: r.url, ambientTag: AMBIENT, tempo: 1.0, narratorOffIntervals: padded.length ? padded : undefined });
    console.log("ambiente:", pp.appliedAmbientTag, pp.audioFilename);
  }

  const final = await p.journeyStory.findUnique({ where: { id: story.id }, select: { dialogueSpec: true, audioFragments: true } });
  const sl = Array.isArray(final!.dialogueSpec) ? (final!.dialogueSpec as any[]).length : 0;
  const fl = Array.isArray(final!.audioFragments) ? (final!.audioFragments as any[]).length : 0;
  console.log(`OK ${SLUG}: dialogueSpec=${sl} fragments=${fl} title-ok=${fl === sl + 1} | ambiente=${AMBIENT ?? "ninguno"}`);
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
