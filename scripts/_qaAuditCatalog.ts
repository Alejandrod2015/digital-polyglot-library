/**
 * _qaAuditCatalog.ts: auditoría batch del catálogo de clips de práctica con
 * el Oído (pasada whisper-LOCAL, gratis; Scribe después SOLO sobre flaggeados).
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/_qaAuditCatalog.ts <cacheDir>
 *
 * Fuentes:
 *  - scripts/_sets/*.json → payload.audioClip.{sentence,clipUrl} (ElevenLabs);
 *    idioma por slug desde la DB (read-only).
 *  - scripts/_qa_audit_inventory.json → ejercicios Piper es con audioUrl.
 * Capas por clip: fonética (whisper solo, SIN exculpación de Scribe: es un
 * FILTRO; los flaggeados pasan luego por Scribe), huecos, velocidad, cola, f0.
 * Un 404 al descargar también es hallazgo (clip referenciado que no existe).
 * Salida: scripts/_qa_audit_report.json (parciales cada 50) + resumen stdout.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma";
import { phoneticCoverage, whisperAnalyze, internalGaps, rateCheck, GAP_MAX_SEC } from "./_qaEar";

const TAIL_MAX_DB = -20;
const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const WH: Record<string, RegExp> = {
  es: /(qué|quién|quiénes|cómo|cuándo|dónde|adónde|cuál|cuáles|cuánto|cuánta|cuántos|cuántas)/i,
  de: /(\bwer\b|\bwen\b|\bwem\b|\bwessen\b|\bwas\b|\bwie\b|\bwieso\b|\bweshalb\b|\bwarum\b|\bwann\b|\bwo\b|\bwohin\b|\bwoher\b|\bwelch)/i,
};
const WLANG: Record<string, string> = { es: "es", de: "de" };

type Item = { key: string; slug: string; word: string; lang: string; engine: "eleven" | "piper"; text: string; url: string };
type Row = Item & { verdict: "PASS" | "FAIL" | "MISSING" | "ERROR"; fails: string[]; notes: string[] };

function sh(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args); let o = "", e = "";
    p.stdout.on("data", (c) => (o += c)); p.stderr.on("data", (c) => (e += c));
    p.on("error", rej); p.on("close", (code) => res({ code: code ?? 1, out: o, err: e }));
  });
}

async function auditOne(it: Item, cache: string): Promise<Row> {
  const row: Row = { ...it, verdict: "PASS", fails: [], notes: [] };
  const mp3 = join(cache, crypto.createHash("sha1").update(it.url).digest("hex").slice(0, 20) + ".mp3");
  try {
    if (!existsSync(mp3)) {
      const res = await fetch(it.url);
      if (!res.ok) { row.verdict = "MISSING"; row.notes.push(`HTTP ${res.status}`); return row; }
      writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
    }
    const w = await whisperAnalyze(mp3, WLANG[it.lang]);
    if (!w) { row.verdict = "FAIL"; row.fails.push("stt"); row.notes.push("whisper no reconoció habla"); return row; }
    const ear = phoneticCoverage(it.text, w.text, null, it.lang);
    if (!ear.ok) { row.fails.push("fonética"); row.notes.push(`${ear.detail} · whisper="${w.text}"`); }
    const gaps = await internalGaps(mp3, w.speechStartSec, w.speechEndSec);
    if (gaps.length) { row.fails.push("huecos"); row.notes.push(gaps.map((g) => `silencio ${g.dur.toFixed(2)}s @${g.start.toFixed(2)}s`).join("; ")); }
    const rc = rateCheck(it.text, it.lang, w.speechEndSec - w.speechStartSec);
    if (!rc.ok) { row.fails.push("velocidad"); row.notes.push(`${rc.rate} fon/seg`); }
    const pr = await sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]);
    const dur = parseFloat(pr.out.trim());
    const tStart = w.speechEndSec + 0.06;
    if (isFinite(dur) && tStart < dur) {
      const v = await sh("ffmpeg", ["-i", mp3, "-af", `atrim=start=${tStart},volumedetect`, "-f", "null", "-"]);
      const m = v.err.match(/max_volume:\s*(-?[\d.]+) dB/);
      if (m && parseFloat(m[1]) > TAIL_MAX_DB) { row.fails.push("cola"); row.notes.push(`cola ${m[1]} dB`); }
    }
    // f0: preguntas sí/no en modo question; el resto en modo statement, que
    // desde 2026-07-23 es gate duro de uptalk (calibrado a oído del usuario)
    const isQ = it.text.trim().endsWith("?") && !WH[it.lang].test(it.text) && !/^\s*¿\s*y\s+si\b/i.test(it.text);
    try {
      const r = await sh(F0_PYTHON, ["scripts/_f0gate.py", mp3, isQ ? "question" : "statement"]);
      if (r.code === 0) {
        const v = JSON.parse(r.out.trim());
        if (!v.ok) { row.fails.push("f0"); row.notes.push(isQ ? `pregunta plana (slope ${v.slope}, end ${v.end})` : v.reason); }
      }
    } catch { /* venv ausente: se omite */ }
    if (row.fails.length) row.verdict = "FAIL";
  } catch (err) {
    row.verdict = "ERROR"; row.notes.push((err as Error).message.slice(0, 120));
  }
  return row;
}

(async () => {
  const cache = process.argv[2];
  if (!cache) throw new Error("uso: _qaAuditCatalog.ts <cacheDir>");
  mkdirSync(cache, { recursive: true });

  // ---- inventario ElevenLabs desde scripts/_sets ----
  const prisma = new PrismaClient();
  const setFiles = readdirSync("scripts/_sets").filter((f) => f.endsWith(".json"));
  const slugs = setFiles.map((f) => f.slice(0, -5));
  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, journey: { select: { language: true } } },
  });
  await prisma.$disconnect();
  const langBySlug = new Map(stories.map((s) => [s.slug, s.journey.language === "german" ? "de" : s.journey.language === "spanish" ? "es" : "??"]));

  const items: Item[] = [];
  for (const f of setFiles) {
    const slug = f.slice(0, -5);
    const lang = langBySlug.get(slug);
    if (lang !== "es" && lang !== "de") continue; // it/pt: fuera del alcance del Oído
    const exs = JSON.parse(readFileSync(join("scripts/_sets", f), "utf8"));
    for (const e of Array.isArray(exs) ? exs : []) {
      const ac = e?.payload?.audioClip;
      if (!ac?.clipUrl || !ac?.sentence) continue;
      items.push({ key: `${slug}__${e.word}`, slug, word: e.word, lang, engine: "eleven", text: ac.sentence, url: ac.clipUrl });
    }
  }
  // ---- inventario Piper (dump previo de la DB) ----
  for (const r of JSON.parse(readFileSync("scripts/_qa_audit_inventory.json", "utf8"))) {
    const text = (r.text as string).replace(/_{2,}/g, r.word);
    items.push({ key: r.id, slug: r.slug ?? "?", word: r.word, lang: r.lang, engine: "piper", text, url: r.url });
  }
  console.log(`a auditar: ${items.length} (eleven=${items.filter((i) => i.engine === "eleven").length}, piper=${items.filter((i) => i.engine === "piper").length})`);

  // ---- pool de 4 ----
  const rows: Row[] = [];
  let idx = 0, done = 0;
  async function worker() {
    while (idx < items.length) {
      const it = items[idx++];
      rows.push(await auditOne(it, cache));
      done++;
      if (done % 50 === 0) {
        writeFileSync("scripts/_qa_audit_report.json", JSON.stringify(rows, null, 1));
        console.log(`${done}/${items.length} · flaggeados hasta ahora: ${rows.filter((r) => r.verdict !== "PASS").length}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  writeFileSync("scripts/_qa_audit_report.json", JSON.stringify(rows, null, 1));

  const flag = rows.filter((r) => r.verdict !== "PASS");
  console.log(`\n== RESUMEN == total=${rows.length} pass=${rows.length - flag.length} flag=${flag.length}`);
  const byLayer: Record<string, number> = {};
  for (const r of flag) for (const f of r.fails.length ? r.fails : [r.verdict]) byLayer[f] = (byLayer[f] || 0) + 1;
  for (const [k, v] of Object.entries(byLayer).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  for (const [k, v] of Object.entries(
    flag.reduce((m: Record<string, number>, r) => ((m[`${r.engine}/${r.lang}`] = (m[`${r.engine}/${r.lang}`] || 0) + 1), m), {})
  )) console.log(`  cohorte ${k}: ${v}`);
})();
