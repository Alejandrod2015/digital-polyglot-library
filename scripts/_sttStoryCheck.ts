// Transcribe la narración de una historia y la compara con su texto, frase a
// frase. Sirve para detectar audio que DICE OTRA COSA (el "delirio"), que es
// justo lo que el oído pilla y ninguna métrica de duración o volumen ve.
// Solo lee y transcribe; no genera audio.
//   npx tsx scripts/_sttStoryCheck.ts <slug> [<slug>...]
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const apiKey = process.env.ELEVENLABS_API_KEY!;

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
   .replace(/[""„«»".,!?;:()¿¡'`\-—–]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

async function stt(buf: Buffer): Promise<string> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", "por");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: fd });
  if (!r.ok) throw new Error(`STT ${r.status} ${(await r.text()).slice(0, 120)}`);
  return ((await r.json()) as { text?: string }).text ?? "";
}

/** Palabras del texto esperado que NO aparecen en lo transcrito. */
function faltantes(esperado: string, oido: string): string[] {
  const oidoSet = new Set(strip(oido).split(" "));
  const oidoJoin = strip(oido).split(" ").join("");
  return strip(esperado).split(" ").filter((w) => w.length >= 4 && !oidoSet.has(w) && !oidoJoin.includes(w));
}

(async () => {
  const slugs = process.argv.slice(2);
  if (!slugs.length) throw new Error("usage: _sttStoryCheck.ts <slug> [<slug>...]");
  for (const slug of slugs) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true, audioUrl: true } });
    if (!s?.audioUrl) { console.log(`${slug}: sin audio`); continue; }
    console.log(`\n═══ ${s.title} (${slug})`);
    const buf = Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer());
    console.log(`   audio: ${(buf.length / 1024).toFixed(0)} KB`);
    const oido = await stt(buf);

    // Comparación frase a frase: una frase cuyo vocabulario no aparece en la
    // transcripción es candidata a estar mal narrada.
    const frases = (s.text ?? "").split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean);
    let sospechosas = 0;
    for (const f of frases) {
      const miss = faltantes(f, oido);
      const ratio = miss.length / Math.max(1, strip(f).split(" ").filter((w) => w.length >= 4).length);
      if (ratio >= 0.34) {
        sospechosas++;
        console.log(`   ⚠ ${Math.round(ratio * 100)}% sin aparecer :: ${f}`);
        console.log(`      no se oyen: ${miss.slice(0, 8).join(", ")}`);
      }
    }
    console.log(sospechosas === 0 ? "   ✓ todas las frases aparecen en la transcripción" : `   ${sospechosas}/${frases.length} frases sospechosas`);

    // Y al revés: lo que se oye y NO está en el texto (el "delirio" añadido).
    const textoSet = new Set(strip(s.text ?? "").split(" "));
    const textoJoin = strip(s.text ?? "").split(" ").join("");
    const inventadas = strip(oido).split(" ").filter((w) => w.length >= 4 && !textoSet.has(w) && !textoJoin.includes(w));
    if (inventadas.length) {
      console.log(`   ⚠ se oyen ${inventadas.length} palabras que NO están en el texto: ${[...new Set(inventadas)].slice(0, 15).join(", ")}`);
    } else {
      console.log("   ✓ no se oye nada fuera del texto");
    }
  }
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); }).finally(() => p.$disconnect());
