import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || process.env.XI_API_KEY || "";
const J = "cmqp6hal8000032cb4ywfs0gc";
const OUT = "public/_voice-sample";
const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech/";

// 1 representative line per distinct voice in «Sábado de mercado»
const LINES: { speaker: string; text: string }[] = [
  { speaker: "narrator", text: "Sofía y su amiga Renata caminan al mercado del barrio. Es sábado por la mañana en la Ciudad de México." },
  { speaker: "Sofía", text: "Mira, Renata. Esos mangos se ven muy buenos." },
  { speaker: "Renata", text: "Sí, pero están caros. Mejor llevamos plátanos." },
  { speaker: "Vendedora", text: "Pásenle, niñas. Las naranjas están muy buenas hoy." },
];

const VS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };

(async () => {
  const p = new PrismaClient();
  const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug: "sabado-de-mercado" }, select: { dialogueSpec: true } });
  const spec: any[] = Array.isArray(s?.dialogueSpec) ? s!.dialogueSpec as any[] : [];
  const voiceBy = new Map<string, string>();
  for (const seg of spec) if (seg?.speaker && seg?.voice) voiceBy.set(String(seg.speaker).toLowerCase(), seg.voice);
  await p.$disconnect();

  fs.mkdirSync(OUT, { recursive: true });
  const done: { speaker: string; voice: string; file: string; text: string }[] = [];
  for (const { speaker, text } of LINES) {
    const voice = voiceBy.get(speaker.toLowerCase());
    if (!voice) { console.log(`!! sin voiceId para ${speaker}`); continue; }
    const res = await fetch(`${ENDPOINT}${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: VS }),
    });
    if (!res.ok) { console.log(`!! ${speaker} -> ${res.status} ${await res.text()}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const file = `${speaker.toLowerCase()}.mp3`;
    fs.writeFileSync(`${OUT}/${file}`, buf);
    done.push({ speaker, voice: voice.slice(0, 6), file, text });
    console.log(`ok ${speaker} (${voice.slice(0, 6)}) -> ${OUT}/${file} (${buf.length} bytes)`);
  }

  const html = `<!doctype html><meta charset="utf-8"><title>Sample · Sábado de mercado</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;">
<h2>Sample de voces · «Sábado de mercado» (A1)</h2>
<p style="color:#666">v2, settings de producción. 1 línea por voz. Escucha timbre y uptalk.</p>
${done.map(d => `<div style="margin:18px 0;padding:14px;border:1px solid #ddd;border-radius:10px">
<b>${d.speaker}</b> <span style="color:#999">· ${d.voice}</span><br>
<p style="margin:6px 0">${d.text}</p>
<audio controls preload="none" src="/_voice-sample/${d.file}"></audio></div>`).join("\n")}
</body>`;
  fs.writeFileSync("public/_voice-sample.html", html);
  console.log("\nPágina: public/_voice-sample.html");
})().catch(e => { console.error(e); process.exit(1); });
