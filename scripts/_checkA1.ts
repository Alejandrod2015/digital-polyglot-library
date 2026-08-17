import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
(async () => {
  const rows = await prisma.journeyStory.findMany({ where: { journeyId: J, level: "a1" }, select: { slug: true, dialogueSpec: true } });
  const voices = new Map<string, Set<string>>();
  for (const s of rows) {
    const spec = Array.isArray(s.dialogueSpec) ? (s.dialogueSpec as any[]) : [];
    for (const seg of spec) { if (!seg?.voice) continue; if (!voices.has(seg.voice)) voices.set(seg.voice, new Set()); voices.get(seg.voice)!.add(seg.speaker); }
  }
  console.log(`${voices.size} voiceIds distintos en specs A1:\n`);
  let bad = 0;
  for (const [id, spk] of voices) {
    let status = "?", name = "";
    try { const r = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, { headers: { "xi-api-key": KEY } }); status = String(r.status); if (r.ok) { const j: any = await r.json(); name = j?.name || ""; } } catch { status = "ERR"; }
    if (status !== "200") bad++;
    console.log(`  ${status === "200" ? "OK " : "!! "} ${id} [${status}] ${name.padEnd(26)} speakers=${[...spk].join("/")}`);
  }
  console.log(bad ? `\n⚠ ${bad} voces NO están en la cuenta` : `\nTodas las voces A1 en cuenta (200).`);
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
