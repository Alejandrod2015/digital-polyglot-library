// Verify a set's listen_choose voiceId matches the actual speaker of that line
// in the story's dialogueSpec. Usage: npx tsx scripts/_chkListenVoice.ts <slug>
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[«»"¿¡!?.,:;]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
(async () => {
  const slug = process.argv[2];
  const exs = JSON.parse(readFileSync(`scripts/_sets/${slug}.json`, "utf8"));
  const l = exs.find((e: any) => e.type === "listen_choose");
  if (!l) { console.log(slug, "sin listen"); return; }
  const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { dialogueSpec: true, voiceId: true } });
  const spec = (s?.dialogueSpec as any[]) || [];
  const target = norm(l.sentence);
  const hit = spec.find((seg) => norm(String(seg.text)).includes(target) || target.includes(norm(String(seg.text))));
  const claimed = l.payload.audioClip.voiceId;
  if (!hit) { console.log(`${slug}: línea no hallada en dialogueSpec (narrador? voz historia=${s?.voiceId}) claimed=${claimed} ${s?.voiceId === claimed ? "OK-narrador" : "REVISAR"}`); return; }
  console.log(`${slug}: hablante=${hit.speaker} voz=${hit.voice} claimed=${claimed} ${hit.voice === claimed ? "OK" : "MISMATCH"}`);
})().finally(() => prisma.$disconnect());
