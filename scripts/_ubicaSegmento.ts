import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { PrismaClient } from "../src/generated/prisma";
import { softenPunctuationForTts, DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODEL_V2 } from "../src/lib/elevenlabs";
const p = new PrismaClient();
const key = (v: string, t: string) => crypto.createHash("sha256")
  .update(`${v}|${ELEVENLABS_MODEL_V2}|${JSON.stringify(DEFAULT_VOICE_SETTINGS)}|${softenPunctuationForTts(t)}|trim-v7-noprev`)
  .digest("hex").slice(0, 24);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
(async () => {
  const buscado = process.argv[3];
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { voiceId: true, audioFragments: true } });
  const fr = (s?.audioFragments ?? []) as Array<{ index: number; text: string; startSec: number; endSec: number }>;
  for (const f of fr) {
    const k = key(s!.voiceId!, f.text);
    if (!buscado || k.startsWith(buscado)) console.log(`${mmss(f.startSec)}-${mmss(f.endSec)} · ${k} · ${f.text.slice(0, 70)}`);
  }
  await p.$disconnect();
})();
