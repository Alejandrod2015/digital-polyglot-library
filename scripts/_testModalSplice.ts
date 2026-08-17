import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
const TOKEN = (process.env.STUDIO_AUDIO_TOKEN || "").trim();
const SYNTH = (process.env.STUDIO_AUDIO_SYNTH_URL || process.env.MODAL_AUDIO_STUDIO_URL || "").trim();

function spliceUrl(): string {
  // Prefer deriving from a configured synth URL; else use the known deploy.
  if (SYNTH.includes("-synthesize.modal.run")) return SYNTH.replace("-synthesize.modal.run", "-splice-upload.modal.run");
  return "https://alejandrod2015--polyglot-audio-studio-splice-upload.modal.run";
}

(async () => {
  if (!TOKEN) { console.log("NO STUDIO_AUDIO_TOKEN"); process.exit(1); }
  const s = await prisma.journeyStory.findFirst({ where: { journeyId: J, slug: "sabado-de-mercado" }, select: { audioUrl: true, audioFragments: true } });
  const frags: any[] = Array.isArray(s?.audioFragments) ? (s!.audioFragments as any) : [];
  // pick a mid body section (not title) that has a url
  const frag = frags.find((f, i) => i > 0 && f.url && f.endSec - f.startSec > 0.5);
  if (!s?.audioUrl || !frag) { console.log("sin master/sección de prueba"); process.exit(1); }
  console.log(`master=${s.audioUrl.split("/").pop()}`);
  console.log(`probando sección idx=${frag.index} [${frag.startSec}..${frag.endSec}] (${(frag.endSec - frag.startSec).toFixed(2)}s) "${(frag.text || "").slice(0, 40)}"`);
  const segB64 = Buffer.from(await (await fetch(frag.url)).arrayBuffer()).toString("base64");

  const res = await fetch(spliceUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _token: TOKEN,
      audioUrl: s.audioUrl,
      segmentBase64: segB64,
      startSec: frag.startSec,
      endSec: frag.endSec,
      filename: `__test_splice_${Date.now()}.mp3`,
      crossfadeSec: 0,
    }),
  });
  console.log("HTTP", res.status);
  const json: any = await res.json().catch(() => ({}));
  console.log(JSON.stringify(json, null, 2));
  const okDur = typeof json.segDurationSec === "number";
  const close = okDur ? Math.abs(json.segDurationSec - (frag.endSec - frag.startSec)) : 999;
  console.log(`\n${res.ok && json.url && okDur ? "PASS" : "FAIL"}; url=${!!json.url} segDurationSec=${json.segDurationSec} (esperado~${(frag.endSec - frag.startSec).toFixed(2)}, dif=${close.toFixed(2)}s)`);
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
