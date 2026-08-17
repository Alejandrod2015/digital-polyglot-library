// Huecos y anomalías de ritmo: tramos donde el reconocedor no oye palabras.
// Un balbuceo, un ruido o una repetición dejan un hueco temporal aunque el
// texto transcrito acabe pareciéndose al esperado.
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const apiKey = process.env.ELEVENLABS_API_KEY!;
type Word = { text: string; start?: number; end?: number; type?: string };
(async () => {
  for (const slug of process.argv.slice(2)) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, audioUrl: true } });
    if (!s?.audioUrl) continue;
    const buf = Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer());
    const fd = new FormData();
    fd.append("model_id", "scribe_v1"); fd.append("language_code", "por"); fd.append("timestamps_granularity", "word");
    fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "s.mp3");
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: fd });
    const j = (await r.json()) as { words?: Word[] };
    const ws = (j.words ?? []).filter((w) => (w.type ?? "word") === "word");
    console.log(`\n═══ ${s.title}`);
    let peor = 0, peorT = 0;
    for (let i = 1; i < ws.length; i++) {
      const hueco = (ws[i].start ?? 0) - (ws[i - 1].end ?? 0);
      if (hueco > peor) { peor = hueco; peorT = ws[i - 1].end ?? 0; }
      if (hueco >= 1.2) {
        console.log(`   ⚠ hueco de ${hueco.toFixed(2)}s tras "${ws[i - 1].text}" (${(ws[i - 1].end ?? 0).toFixed(1)}s) antes de "${ws[i].text}"`);
      }
    }
    console.log(`   hueco mayor: ${peor.toFixed(2)}s a los ${peorT.toFixed(1)}s`);
    // Palabras repetidas consecutivas: el síntoma clásico del "delirio" del TTS.
    for (let i = 1; i < ws.length; i++) {
      const a = ws[i - 1].text.toLowerCase().replace(/\W/g, ""), b = ws[i].text.toLowerCase().replace(/\W/g, "");
      if (a && a === b) console.log(`   ⚠ repite "${ws[i].text}" a los ${(ws[i].start ?? 0).toFixed(1)}s`);
    }
  }
})().catch((e) => console.log("FATAL", e.message)).finally(() => p.$disconnect());
