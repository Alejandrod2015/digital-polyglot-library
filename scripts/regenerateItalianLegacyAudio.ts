/**
 * Re-generate audio for every published italian JourneyStory whose
 * `voiceId` is null (legacy stories from before voice tracking
 * existed). For each:
 *   1. Synthesize a fresh mp3 with `piper/it_IT-paola-medium` via Modal.
 *   2. Apply narration post-process: tempo 0.80, NO ambient, aeneas
 *      re-alignment so `audioWordTimings` and `audioSegments` line up
 *      with the new file.
 *   3. Persist the new `audioUrl`, `voiceId`, `ambientTag` (cleared) in
 *      the DB.
 *
 * Why we do this: the original mp3s were rendered with some unknown
 * voice (no tracking back then), and on top of that they have an
 * ambient bed mixed in. With this batch all italian legacy stories
 * end up speaking with Paola Piper, clean, and the mobile practice
 * exercises (which call /api/practice/sentence-tts with the story's
 * voiceId) finally render with the same voice the reader hears.
 *
 * Usage: tsx scripts/regenerateItalianLegacyAudio.ts
 *        tsx scripts/regenerateItalianLegacyAudio.ts --dry-run
 *        tsx scripts/regenerateItalianLegacyAudio.ts --story <slug>
 */
import { prisma } from "../src/lib/prisma";
import { buildAudioNarrationText } from "../src/lib/elevenlabs";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

const TARGET_VOICE = "piper/it_IT-paola-medium";
const TARGET_TEMPO = 0.80;

async function synthesizeViaModal(args: {
  text: string;
  voiceId: string;
  filename: string;
}): Promise<{ url: string; filename: string }> {
  const url = process.env.STUDIO_AUDIO_URL;
  const token = process.env.STUDIO_AUDIO_TOKEN;
  if (!url || !token) throw new Error("STUDIO_AUDIO_URL/TOKEN missing in env");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _token: token,
      text: args.text,
      voiceId: args.voiceId,
      filename: args.filename.replace(/\.mp3$/, ""),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Modal TTS ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json() as Promise<{ url: string; filename: string }>;
}

function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
}

async function regenerate(storyId: string, slug: string, title: string, text: string): Promise<void> {
  const start = Date.now();
  const narration = buildAudioNarrationText(title, text);
  const filename = `${slugify(title)}_${Date.now()}.mp3`;

  console.log(`[${slug}] synthesize with paola via Modal…`);
  const modalRes = await synthesizeViaModal({ text: narration, voiceId: TARGET_VOICE, filename });
  console.log(`[${slug}]   modal returned ${modalRes.url}`);

  // Set voiceId + audioUrl up front so applyNarrationPostProcess sees them.
  await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      voiceId: TARGET_VOICE,
      audioUrl: modalRes.url,
      audioFilename: modalRes.filename,
      ambientTag: null,
    },
  });

  console.log(`[${slug}] post-process (tempo=${TARGET_TEMPO}, ambient=null, aeneas re-align)…`);
  const post = await applyNarrationPostProcess({
    storyId,
    sourceUrl: modalRes.url,
    tempo: TARGET_TEMPO,
    ambientTag: null,
  });
  console.log(`[${slug}]   final mp3 ${post.audioUrl}`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[${slug}] done in ${elapsed}s`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const slugIdx = args.indexOf("--story");
  const singleSlug = slugIdx >= 0 ? args[slugIdx + 1] : null;

  const stories = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      voiceId: null,
      ...(singleSlug ? { slug: singleSlug } : {}),
      journey: { language: { equals: "italian", mode: "insensitive" } },
    },
    select: { id: true, slug: true, title: true, text: true },
    orderBy: [{ level: "asc" }, { slotIndex: "asc" }],
  });

  console.log(`Found ${stories.length} italian legacy stories.`);
  if (dryRun) {
    for (const s of stories) console.log(` - ${s.slug} | ${s.title?.slice(0, 60)}`);
    return;
  }

  let ok = 0, fail = 0;
  for (const s of stories) {
    if (!s.text || !s.title) { console.log(`[${s.slug}] SKIP (missing text or title)`); fail += 1; continue; }
    try {
      await regenerate(s.id, s.slug, s.title, s.text);
      ok += 1;
    } catch (err) {
      console.error(`[${s.slug}] FAIL:`, err instanceof Error ? err.message : err);
      fail += 1;
    }
  }
  console.log(`\nFinished. ${ok} ok, ${fail} failed.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
