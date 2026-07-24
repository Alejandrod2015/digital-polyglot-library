/**
 * _qaAuditScribePass.ts: segunda opinión Scribe SOLO para los clips que la
 * pasada whisper-local flaggeó por "fonética" (el filtro de un solo motor
 * rechaza dialecto a propósito; Scribe + regla de dos motores decide).
 *
 *   npx tsx --env-file=.env.local scripts/_qaAuditScribePass.ts <cacheDir>
 *
 * Lee scripts/_qa_audit_report.json, re-evalúa la capa fonética con
 * phoneticCoverage(text, txScribe, txWhisper) y escribe
 * scripts/_qa_audit_report_final.json con los veredictos actualizados.
 * Los flags de huecos/velocidad/cola/f0 NO se tocan (no dependen del STT).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import { phoneticCoverage, whisperTranscribe } from "./_qaEar";

const SCRIBE_CODE: Record<string, string> = { es: "spa", de: "deu" };
const WLANG: Record<string, string> = { es: "es", de: "de" };

async function scribe(mp3: string, langCode: string, key: string): Promise<string | null> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", langCode);
  fd.append("file", new Blob([new Uint8Array(readFileSync(mp3))], { type: "audio/mpeg" }), "s.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: fd });
  if (!res.ok) return null;
  return (((await res.json()) as { text?: string }).text || "").trim() || null;
}

(async () => {
  const cache = process.argv[2];
  if (!cache) throw new Error("uso: _qaAuditScribePass.ts <cacheDir>");
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  const rows = JSON.parse(readFileSync("scripts/_qa_audit_report.json", "utf8"));
  const targets = rows.filter((r: any) => r.fails?.includes("fonética"));
  console.log(`re-evaluando con Scribe: ${targets.length} clips`);
  let cleared = 0;
  for (const r of targets) {
    const mp3 = join(cache, crypto.createHash("sha1").update(r.url).digest("hex").slice(0, 20) + ".mp3");
    if (!existsSync(mp3)) { r.notes.push("scribe-pass: mp3 no cacheado"); continue; }
    const [txS, txW] = await Promise.all([scribe(mp3, SCRIBE_CODE[r.lang], key), whisperTranscribe(mp3, WLANG[r.lang])]);
    if (!txS) { r.notes.push("scribe-pass: STT falló"); continue; }
    const ear = phoneticCoverage(r.text, txS, txW, r.lang);
    if (ear.ok) {
      r.fails = r.fails.filter((f: string) => f !== "fonética");
      r.notes.push(`scribe-pass OK: "${txS}"`);
      if (r.fails.length === 0) { r.verdict = "PASS"; cleared++; }
    } else {
      r.notes.push(`scribe-pass CONFIRMA: ${ear.detail} · scribe="${txS}"`);
    }
  }
  writeFileSync("scripts/_qa_audit_report_final.json", JSON.stringify(rows, null, 1));
  const flag = rows.filter((r: any) => r.verdict !== "PASS");
  console.log(`limpiados por Scribe: ${cleared} · flag final: ${flag.length}/${rows.length}`);
  const byLayer: Record<string, number> = {};
  for (const r of flag) for (const f of (r.fails?.length ? r.fails : [r.verdict])) byLayer[f] = (byLayer[f] || 0) + 1;
  for (const [k, v] of Object.entries(byLayer).sort((a: any, b: any) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
})();
