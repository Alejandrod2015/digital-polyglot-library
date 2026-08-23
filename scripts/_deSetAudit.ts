/**
 * Lo que `_validateSets.ts` NO mira en los sets curados del Traveler DE A0:
 * nombres de personaje en la oracion (regla 8, rompe el TTS), un distractor
 * que ya esta escrito en la propia frase, y opciones de distinta forma.
 *
 *   npx tsx scripts/_deSetAudit.ts <slug> [<slug>...]
 */
import * as fs from "fs";
const NOMBRES = ["Hannah", "Elias", "Sophie", "Noah", "Emilia", "Leon", "Marie"];
let malo = 0;
for (const slug of process.argv.slice(2)) {
  const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${slug}.json`, "utf8")) as any[];
  for (const e of exs) {
    const sent = String(e.sentence ?? "").replace(/\[\[|\]\]/g, "");
    const todo = JSON.stringify(e);
    const di = (e.payload?.options ?? []).slice(1).map(String);
    const flags: string[] = [];
    const n = NOMBRES.filter((x) => new RegExp(`\\b${x}`, "u").test(todo));
    if (n.length) flags.push(`nombre propio: ${n.join(", ")}`);
    const dentro = di.filter((d: string) => new RegExp(`\\b${d}\\b`, "iu").test(sent));
    if (dentro.length) flags.push(`distractor ya en la frase: ${dentro.join(", ")}`);
    // Forma: en aleman la mayuscula separa sustantivo de verbo/adjetivo.
    const caja = (w: string) => /^[A-ZÄÖÜ]|^(der|die|das)\s/.test(w);
    if (e.type === "fill_blank" && di.length && di.some((d: string) => caja(d) !== caja(String(e.payload?.answer ?? "")))) flags.push(`opciones de distinta forma: ${e.payload?.answer} vs ${di.join(", ")}`);
    if (e.type === "meaning_in_context") {
      const todas = [String(e.payload?.answer ?? ""), ...di];
      const may = (w: string) => /^[A-Z]/.test(w);
      if (new Set(todas.map(may)).size > 1) flags.push(`glosas sin paralelismo: ${todas.join(" / ")}`);
    }
    if (/\d/.test(sent)) flags.push("cifra en la oracion");
    if (flags.length) { malo++; console.log(`${slug} '${e.word}': ${flags.join(" | ")}`); }
  }
}
console.log(malo === 0 ? "sin marcas" : `${malo} ejercicios marcados`);
