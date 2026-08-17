import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import crypto from "node:crypto";
import { getPublicObjectUrl } from "../src/lib/objectStorage";

const CACHE_VERSION = "v8";
const VARIANT = "";
const VOICE: Record<string, string> = { spanish: "yHD4CsKkghm19ToGLJEC", italian: "gfKKsLN1k0oYYN9n2dXX", german: "Ww7Sq9tx9CCOiNOwWgsx" };
const LANGCODE: Record<string, string> = { spanish: "spa", german: "deu", italian: "ita" };

const SENTENCES: Array<{ s: string; lang: string }> = [
  { lang: "german", s: "Der Duft von frischem Kaffee liegt in der Luft." },
  { lang: "german", s: "Sie bestellt einen Kaffee am Tresen." },
  { lang: "german", s: "Zwischen ihnen sprang sofort ein Funke über." },
  { lang: "german", s: "Für einen Moment stand die Zeit still." },
  { lang: "german", s: "Er packte seinen Koffer für die Reise." },
  { lang: "german", s: "Sie ging durch die vollen Abteile des Zuges." },
  { lang: "german", s: "Ich kaufe die Fahrkarte am Automaten." },
  { lang: "german", s: "Vor dem Auftritt hatte sie starkes Herzklopfen." },
  { lang: "german", s: "Aus dem Fenster sah sie die schöne Landschaft." },
  { lang: "german", s: "Sie brachte viele Neuigkeiten zum Treffen mit." },
  { lang: "german", s: "Er war schon auf dem Sprung zur Arbeit." },
  { lang: "spanish", s: "Voy a colgar el teléfono en un momento." },
  { lang: "spanish", s: "Los senderos del bosque son estrechos y verdes." },
  { lang: "spanish", s: "La familia adornó el altar con flores y velas." },
  { lang: "italian", s: "Giulia è una donna calma ma molto determinata." },
  { lang: "italian", s: "Devo avvolgere il regalo con carta rossa." },
  { lang: "italian", s: "Prende la forchetta e assaggia la pasta." },
  { lang: "german", s: "Das Kind wollte die bittere Medizin sofort ausspucken." },
  { lang: "german", s: "Sie kämpfte lange mit ihren Tränen." },
  { lang: "german", s: "Der Bahnhof ist ein wichtiger Knotenpunkt der Stadt." },
  { lang: "german", s: "Im Café hörte man nur ein leises Stimmengewirr." },
  { lang: "german", s: "Die Durchsage kündigte eine Verspätung an." },
  { lang: "german", s: "Die Sonne brannte gnadenlos auf den Platz." },
  { lang: "german", s: "Der Himmel wurde allmählich dunkler." },
  { lang: "german", s: "Der Bus musste durch den Verkehr kriechen." },
];

const norm = (t: string) => t.toLowerCase().normalize("NFC").replace(/[.,!?;:"'“”„«»]/g, "").replace(/\s+/g, " ").trim();
function keyFor(lang: string, sentence: string) {
  const h = crypto.createHash("sha256").update(`${CACHE_VERSION}|el|${lang}|${VARIANT}|${VOICE[lang]}|${sentence}`).digest("hex").slice(0, 24);
  return `media/practice/tts/el-${h}.mp3`;
}

async function stt(buf: Buffer, langCode: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("language_code", langCode);
  form.append("file", new Blob([buf]), "clip.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: form });
  if (!res.ok) return `(STT ${res.status})`;
  const j = (await res.json()) as { text?: string };
  return j.text ?? "";
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const mismatches: string[] = [];
  for (const { s, lang } of SENTENCES) {
    const url = getPublicObjectUrl(keyFor(lang, s));
    if (!url) { console.log(`✗ ${s} (sin URL)`); continue; }
    const r = await fetch(url);
    if (!r.ok) { console.log(`✗ HTTP ${r.status}: ${s}`); mismatches.push(s); continue; }
    const heard = await stt(Buffer.from(await r.arrayBuffer()), LANGCODE[lang], apiKey);
    const ok = norm(heard) === norm(s);
    console.log(`${ok ? "✓" : "⚠"} [${lang}] ${s}`);
    if (!ok) { console.log(`     STT: ${heard}`); mismatches.push(s); }
  }
  console.log(`\n=== ${SENTENCES.length - mismatches.length}/${SENTENCES.length} coinciden. Discrepancias: ${mismatches.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
