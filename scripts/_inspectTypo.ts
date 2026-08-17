import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function stt(url: string, key: string): Promise<string> {
  const r = await fetch(url); if (!r.ok) return `(HTTP ${r.status})`;
  const form = new FormData();
  form.append("model_id", "scribe_v1"); form.append("language_code", "spa");
  form.append("file", new Blob([Buffer.from(await r.arrayBuffer())]), "c.mp3");
  const s = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: form });
  if (!s.ok) return `(STT ${s.status})`;
  return ((await s.json()) as { text?: string }).text ?? "";
}
async function main() {
  const e = await p.storyPracticeExercise.findUnique({ where: { id: "spe_mrwd2yf3edifjmd" }, select: { word: true, sentence: true, payload: true } });
  const ac = (e?.payload as any)?.audioClip;
  console.log("word:", JSON.stringify(e?.word));
  console.log("sentence:", JSON.stringify(e?.sentence));
  console.log("audioClip.sentence:", JSON.stringify(ac?.sentence));
  console.log("audioClip.clipUrl:", ac?.clipUrl);
  if (ac?.clipUrl) console.log("STT del audio:", JSON.stringify(await stt(ac.clipUrl, process.env.ELEVENLABS_API_KEY!)));
  // contexto en la historia
  const s = await p.journeyStory.findFirst({ where: { slug: "cafe-y-pan-de-yema" }, select: { text: true } });
  const idx = s?.text.indexOf("las puntada") ?? -1;
  if (idx >= 0) console.log("\nhistoria (contexto):", JSON.stringify(s!.text.slice(Math.max(0, idx - 40), idx + 40)));
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
