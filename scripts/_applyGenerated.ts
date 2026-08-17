import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

// Oraciones generadas AQUÍ (Claude Code), ≤100, completas, con la palabra en su
// sentido. Key: `${language}::${word.toLowerCase()}`.
const GENERATED: Record<string, string> = {
  "german::duft": "Der Duft von frischem Kaffee liegt in der Luft.",
  "german::tresen": "Sie bestellt einen Kaffee am Tresen.",
  "german::funke": "Zwischen ihnen sprang sofort ein Funke über.",
  "german::moment": "Für einen Moment stand die Zeit still.",
  "german::koffer": "Er packte seinen Koffer für die Reise.",
  "german::abteile": "Sie ging durch die vollen Abteile des Zuges.",
  "german::fahrkarte": "Ich kaufe die Fahrkarte am Automaten.",
  "german::herzklopfen": "Vor dem Auftritt hatte sie starkes Herzklopfen.",
  "german::landschaft": "Aus dem Fenster sah sie die schöne Landschaft.",
  "german::neuigkeiten": "Sie brachte viele Neuigkeiten zum Treffen mit.",
  "german::auf dem sprung": "Er war schon auf dem Sprung zur Arbeit.",
  "spanish::colgar": "Voy a colgar el teléfono en un momento.",
  "spanish::senderos": "Los senderos del bosque son estrechos y verdes.",
  "spanish::altar": "La familia adornó el altar con flores y velas.",
  "italian::determinata": "Giulia è una donna calma ma molto determinata.",
  "italian::avvolgere": "Devo avvolgere il regalo con carta rossa.",
  "italian::forchetta": "Prende la forchetta e assaggia la pasta.",
  // Lote 2 (historias vivas, todos ALEMANES; 3 venían mal etiquetados spanish).
  "german::ausspucken": "Das Kind wollte die bittere Medizin sofort ausspucken.",
  "german::kämpfte": "Sie kämpfte lange mit ihren Tränen.",
  "german::knotenpunkt": "Der Bahnhof ist ein wichtiger Knotenpunkt der Stadt.",
  "german::stimmengewirr": "Im Café hörte man nur ein leises Stimmengewirr.",
  "german::durchsage": "Die Durchsage kündigte eine Verspätung an.",
  "german::gnadenlos": "Die Sonne brannte gnadenlos auf den Platz.",
  "german::allmählich": "Der Himmel wurde allmählich dunkler.",
  "german::kriechen": "Der Bus musste durch den Verkehr kriechen.",
};

// Favoritos mal etiquetados: palabras ALEMANAS guardadas como spanish → corregir
// idioma antes de aplicar (si no, audio con voz española + no matchea el key de).
const FIX_LANGUAGE_TO_GERMAN = ["ausspucken", "gnadenlos", "allmählich"];

async function main() {
  const dry = process.argv.includes("--dry");
  // 1) Corregir idioma de palabras alemanas mal etiquetadas.
  const toFix = await p.favorite.findMany({ where: { word: { in: FIX_LANGUAGE_TO_GERMAN }, language: { not: "german" } }, select: { id: true, word: true, language: true } });
  for (const f of toFix) {
    console.log(`${dry ? "[DRY] " : ""}idioma ${f.word}: ${f.language} → german`);
    if (!dry) await p.favorite.update({ where: { id: f.id }, data: { language: "german" } });
  }
  const favs = await p.favorite.findMany({ select: { id: true, word: true, language: true, exampleSentence: true } });
  let updated = 0;
  for (const f of favs) {
    const key = `${(f.language ?? "").toLowerCase()}::${(f.word ?? "").toLowerCase()}`;
    const gen = GENERATED[key];
    if (!gen) continue;
    if (f.exampleSentence === gen) continue;
    console.log(`${dry ? "[DRY] " : ""}${f.word}: "${gen}"`);
    if (!dry) await p.favorite.update({ where: { id: f.id }, data: { exampleSentence: gen } });
    updated++;
  }
  console.log(`\n${dry ? "[DRY] " : ""}actualizados: ${updated}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
