import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const LC: Record<string, string> = { spanish: "spa", german: "deu", italian: "ita" };
const norm = (t: string) => t.toLowerCase().normalize("NFC").replace(/[.,!?;:"“”„¿¡]/g, "").replace(/\s+/g, " ").trim();

async function stt(url: string, lc: string, key: string): Promise<string> {
  const r = await fetch(url); if (!r.ok) return `(HTTP ${r.status})`;
  const form = new FormData();
  form.append("model_id", "scribe_v1"); form.append("language_code", lc);
  form.append("file", new Blob([Buffer.from(await r.arrayBuffer())]), "c.mp3");
  const s = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: form });
  if (!s.ok) return `(STT ${s.status})`;
  return ((await s.json()) as { text?: string }).text ?? "";
}

async function main() {
  const key = process.env.ELEVENLABS_API_KEY!;
  const journeys = await p.journey.findMany({
    where: { status: "active" },
    select: { name: true, language: true, variant: true,
      stories: { where: { status: "published" }, select: { practiceSet: { select: { exercises: { select: { type: true, word: true, payload: true } } } } } } },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });
  for (const j of journeys) {
    const fb: { t: string; u: string }[] = [], mn: { t: string; u: string }[] = [];
    for (const s of j.stories) for (const ex of s.practiceSet?.exercises ?? []) {
      const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
      if (ex.type === "fill_blank" && fb.length < 10 && typeof ac?.clipUrl === "string" && typeof ac?.sentence === "string") fb.push({ t: ac.sentence, u: ac.clipUrl });
      if (ex.type === "meaning_in_context" && mn.length < 2 && typeof ac?.wordClipUrl === "string" && ex.word) mn.push({ t: ex.word, u: ac.wordClipUrl });
    }
    const lc = LC[j.language] ?? "deu";
    let okf = 0, okm = 0;
    const bad: string[] = [];
    for (const x of fb) { const h = await stt(x.u, lc, key); if (norm(h) === norm(x.t)) okf++; else bad.push(`  fill_blank ⚠ TXT:"${x.t}" STT:"${h}"`); }
    for (const x of mn) { const h = await stt(x.u, lc, key); if (norm(h).includes(norm(x.t)) || norm(x.t).includes(norm(h))) okm++; else bad.push(`  meaning ⚠ palabra:"${x.t}" STT:"${h}"`); }
    console.log(`${j.name} (${j.language}/${j.variant}): fill_blank ${okf}/${fb.length} · meaning ${okm}/${mn.length}`);
    bad.forEach((b) => console.log(b));
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
