/**
 * Pre-check local antes de llamar al validador canónico. No lo sustituye:
 * adelanta los fallos baratos (longitud de definición, palabra ausente del
 * cuerpo, nivel CEFR, reparto por bloque de 3 frases, tipos) para no gastar
 * una vuelta entera del gate en cada coma.
 *
 *   npx tsx scripts/_precheckStories.ts <data.json> a1
 */
import * as fs from "fs";
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";

const file = process.argv[2];
const level = (process.argv[3] ?? "a1") as "a1" | "a2" | "b1" | "b2" | "c1";
const stories = JSON.parse(fs.readFileSync(file, "utf8")) as Array<{
  slug: string; title: string; text: string; synopsis: string;
  vocab: { word: string; surface?: string; type: string; definition: string }[];
}>;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
/** Bloques que el lector construye: 3 frases por bloque sobre el texto plano. */
function blocks(text: string): string[] {
  const sent = text.replace(/\n+/g, " ").split(/(?<=[.!?»])\s+/).filter((s) => s.trim());
  const out: string[] = [];
  for (let i = 0; i < sent.length; i += 3) out.push(sent.slice(i, i + 3).join(" "));
  return out;
}

let bad = 0;
for (const s of stories) {
  const issues: string[] = [];
  const bw = words(s.text);
  if (bw < 115 || bw > 170) issues.push(`cuerpo ${bw} palabras (ventana 115-170)`);
  const sw = words(s.synopsis);
  if (sw < 45 || sw > 90) issues.push(`sinopsis ${sw} palabras (45-90)`);

  for (const v of s.vocab) {
    const dw = words(v.definition);
    if (dw < 8 || dw > 14) issues.push(`def "${v.word}": ${dw}w`);
    // Frontera de palabra, no `includes`: con substring, "el bajo" pasaba por
    // aparecer dentro de "del bajo", y el lector, que resalta por palabra
    // completa, no pintaba nada. Un item que no se pinta es un slot perdido.
    // La forma que el lector busca en el cuerpo es `surface ?? word`, igual que
    // en `validateGeneratedStory`. Comprobar solo `word` daba falsos fallos en
    // cuanto el item llevaba lema (`venir` con surface `viene`), que es
    // justo lo que pide la spec §4 para verbos conjugados.
    const needle = v.surface ?? v.word;
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`(^|[^\\p{L}\\p{M}])${esc}([^\\p{L}\\p{M}]|$)`, "iu").test(s.text)) {
      issues.push(`"${needle}" no aparece como palabra completa en el cuerpo`);
    }
    const exempt = v.type === "expression" || ["cultural","realia","slang","coloquial","colloquial"].includes(String((v as {register?:string}).register ?? "").toLowerCase());
    if (!exempt && !isSpanishUpToLevel(v.word, level)) issues.push(`"${v.word}" fuera de ${level}`);
  }

  const n = s.vocab.length;
  const t = (k: string) => s.vocab.filter((v) => v.type === k).length;
  if (n < 20) issues.push(`solo ${n} items de vocab (mínimo 20)`);
  if (t("expression") < 2) issues.push(`${t("expression")} expresiones (mínimo 2)`);
  const pct = (x: number) => Math.round((x / n) * 100);
  if (pct(t("noun")) < 33 || pct(t("noun")) > 55) issues.push(`sustantivos ${pct(t("noun"))}% (33-55)`);
  if (pct(t("verb")) < 22 || pct(t("verb")) > 35) issues.push(`verbos ${pct(t("verb"))}% (22-35)`);

  const B = blocks(s.text);
  const per = B.map((b) => s.vocab.filter((v) => b.toLowerCase().includes((v.surface ?? v.word).toLowerCase())).length);
  const cap = Math.floor(n * 0.3);
  if (Math.max(...per) > cap) issues.push(`bloque con ${Math.max(...per)} items (máx ${cap}) · reparto [${per.join(", ")}]`);
  if (!/[«"]/.test(s.text)) issues.push("sin habla citada");

  if (issues.length) { bad++; console.log(`\n${s.slug}`); for (const i of issues) console.log(`  ${i}`); }
  else console.log(`\n${s.slug}  limpio · ${bw} palabras · ${n} vocab · bloques [${per.join(", ")}]`);
}
console.log(bad ? `\n${bad}/${stories.length} con avisos` : `\n${stories.length}/${stories.length} limpias`);
