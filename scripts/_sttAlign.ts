// Alineación SECUENCIAL entre lo que se oye y lo que debería decirse.
//
// Por qué no basta comparar palabras sueltas: si el audio suelta un balbuceo y
// DESPUÉS dice la frase correcta, una comparación por conjuntos da todo por
// bueno. Es lo que pasó con "A areia queima os pés": el oído humano pilló el
// delirio y el filtro dijo "✓". Aquí se alinea la secuencia con marcas de
// tiempo y se reportan INSERCIONES (lo que sobra) y SALTOS (lo que falta),
// con el segundo exacto para poder ir a escuchar solo ahí.
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const apiKey = process.env.ELEVENLABS_API_KEY!;

type Word = { text: string; start?: number; end?: number; type?: string };
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();

async function sttWords(buf: Buffer): Promise<Word[]> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", "por");
  fd.append("timestamps_granularity", "word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: fd });
  if (!r.ok) throw new Error(`STT ${r.status} ${(await r.text()).slice(0, 120)}`);
  const j = (await r.json()) as { words?: Word[]; text?: string };
  return (j.words ?? []).filter((w) => (w.type ?? "word") === "word" && norm(w.text));
}

/** Diff clásico por subsecuencia común más larga, sobre palabras normalizadas. */
function lcsOps(a: string[], b: string[]) {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: Array<{ op: "same" | "falta" | "sobra"; ai?: number; bi?: number }> = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ op: "same", ai: i, bi: j }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: "falta", ai: i }); i++; }
    else { ops.push({ op: "sobra", bi: j }); j++; }
  }
  while (i < n) ops.push({ op: "falta", ai: i++ });
  while (j < m) ops.push({ op: "sobra", bi: j++ });
  return ops;
}

(async () => {
  const slugs = process.argv.slice(2);
  if (!slugs.length) throw new Error("usage: _sttAlign.ts <slug> [<slug>...]");
  for (const slug of slugs) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true, audioUrl: true } });
    if (!s?.audioUrl || !s.text) { console.log(`${slug}: sin audio o sin texto`); continue; }
    console.log(`\n═══ ${s.title} (${slug})`);
    const buf = Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer());
    const heard = await sttWords(buf);
    const esperado = norm(s.text).split(" ").filter(Boolean);
    const oido = heard.map((w) => norm(w.text)).filter(Boolean);
    console.log(`   texto: ${esperado.length} palabras · audio: ${oido.length} palabras`);

    const ops = lcsOps(esperado, oido);
    // Agrupamos rachas: una palabra suelta es ruido de STT; 2+ seguidas ya es señal.
    type Racha = { tipo: "falta" | "sobra"; palabras: string[]; t0?: number; t1?: number; ctx: string };
    const rachas: Racha[] = [];
    let cur: Racha | null = null;
    for (const o of ops) {
      if (o.op === "same") { if (cur) { rachas.push(cur); cur = null; } continue; }
      const palabra = o.op === "falta" ? esperado[o.ai!] : oido[o.bi!];
      const t = o.op === "sobra" ? heard[o.bi!]?.start : undefined;
      if (cur && cur.tipo === o.op) { cur.palabras.push(palabra); if (t !== undefined && cur.t1 === undefined) cur.t1 = t; }
      else {
        if (cur) rachas.push(cur);
        const ctxIdx = o.op === "falta" ? o.ai! : undefined;
        cur = { tipo: o.op, palabras: [palabra], t0: t, ctx: ctxIdx !== undefined ? esperado.slice(Math.max(0, ctxIdx - 6), ctxIdx + 6).join(" ") : "" };
      }
    }
    if (cur) rachas.push(cur);

    const fuertes = rachas.filter((r) => r.palabras.length >= 2);
    if (!fuertes.length) { console.log("   ✓ sin divergencias de 2+ palabras seguidas"); continue; }
    for (const r of fuertes) {
      const cuando = r.t0 !== undefined ? `a los ${r.t0.toFixed(1)}s` : "";
      if (r.tipo === "sobra") console.log(`   ⚠ SE OYE DE MÁS ${cuando}: "${r.palabras.join(" ")}"`);
      else console.log(`   ⚠ NO SE OYE: "${r.palabras.join(" ")}"  ·  contexto: …${r.ctx}…`);
    }
  }
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); }).finally(() => p.$disconnect());
