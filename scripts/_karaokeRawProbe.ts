/**
 * Re-run the Modal (aeneas) alignment for a few stories and dump the RAW
 * tokens, so raw aeneas can be scored against the stored (drift-corrected)
 * timings with the same ruler. Read-only: writes nothing to the database.
 *
 *   npx tsx scripts/_karaokeRawProbe.ts <outDir> --slug a,b,c
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText, stripSpeakerLabels } from "../src/lib/storyPlainText";

const prisma = new PrismaClient();

const LANG: Record<string, string> = {
  german: "german", spanish: "spanish", italian: "italian",
  portuguese: "portuguese", english: "english", french: "french",
};

function alignUrl(): string {
  const explicit = (process.env.STUDIO_AUDIO_ALIGN_URL || "").trim();
  if (explicit) return explicit;
  const synth = (process.env.STUDIO_AUDIO_URL || "").trim();
  if (synth.includes("-synthesize.modal.run")) {
    return synth.replace("-synthesize.modal.run", "-align.modal.run");
  }
  throw new Error("cannot resolve the Modal align URL");
}

function buildAlignmentText(titleRaw: string, bodyPlain: string) {
  const plainTitle = titleRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plainTitle) return { fullText: bodyPlain, bodyOffset: 0 };
  const titleWithPause = /[.!?…:]$/.test(plainTitle) ? plainTitle : `${plainTitle}.`;
  return {
    fullText: `${titleWithPause}\n\n${bodyPlain}`,
    bodyOffset: titleWithPause.length + 2,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const outDir = argv[0];
  const i = argv.indexOf("--slug");
  const slugs = i >= 0 ? argv[i + 1].split(",").map((s) => s.trim()) : [];
  if (!outDir || slugs.length === 0) throw new Error("usage: <outDir> --slug a,b,c");
  mkdirSync(outDir, { recursive: true });

  const rows = await prisma.journeyStory.findMany({
    where: { slug: { in: slugs }, audioUrl: { not: null } },
    select: {
      slug: true, title: true, text: true, audioUrl: true,
      journey: { select: { language: true } },
    },
  });

  const token = (process.env.STUDIO_AUDIO_TOKEN || "").trim();
  for (const row of rows) {
    if (!row.text || !row.audioUrl) continue;
    const storyPlain = extractStoryPlainText(row.text);
    const { stripped } = stripSpeakerLabels(storyPlain);
    const { fullText, bodyOffset } = buildAlignmentText(row.title ?? "", stripped);

    const res = await fetch(alignUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _token: token,
        audioUrl: row.audioUrl,
        text: fullText,
        language: LANG[row.journey.language] ?? row.journey.language,
      }),
    });
    if (!res.ok) {
      console.log(`  ${row.slug}: align ${res.status} ${(await res.text()).slice(0, 160)}`);
      continue;
    }
    const data = (await res.json()) as {
      audioDurationSec?: number | null;
      tokens?: Array<Record<string, unknown>>;
    };
    const words = (data.tokens ?? [])
      .filter((t) => typeof t.charStart === "number" && (t.charStart as number) >= bodyOffset)
      .map((t) => ({
        text: String(t.text ?? ""),
        charStart: (t.charStart as number) - bodyOffset,
        charEnd: (t.charEnd as number) - bodyOffset,
        startSec: typeof t.startSec === "number" ? t.startSec : null,
        endSec: typeof t.endSec === "number" ? t.endSec : null,
      }));

    const mp3 = path.join(outDir, `${row.slug}.mp3`);
    const audio = await fetch(row.audioUrl);
    writeFileSync(mp3, Buffer.from(await audio.arrayBuffer()));
    writeFileSync(
      path.join(outDir, `${row.slug}.json`),
      JSON.stringify(
        {
          slug: row.slug,
          language: row.journey.language,
          audioDurationSec: data.audioDurationSec ?? null,
          words,
        },
        null,
        2
      )
    );
    console.log(`  ${row.slug}: ${words.length} raw body tokens`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
