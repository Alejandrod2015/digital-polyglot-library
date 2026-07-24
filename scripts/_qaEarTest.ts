/**
 * Regresión del coverage fonético (_qaEar.ts) contra el fixture calibrado.
 *
 * Fixture: scripts/_qa_fixture_transcripts.json, 14 takes REALES (audio bueno
 * verificado de oído, 2026-07-22) que el gate ortográfico rechazaba, con sus
 * transcripciones reales de Scribe y whisper. TODOS deben pasar.
 * Malos: defectos sintéticos (palabra dropeada, truncado, alucinada, swap)
 * construidos sobre las mismas oraciones; whisper=scribe (peor caso: ambos
 * motores oyen lo mismo). TODOS deben rechazarse.
 *
 * Correr: npx tsx scripts/_qaEarTest.ts   (exit 1 si algo se desvía)
 */
import { readFileSync } from "fs";
import { join } from "path";
import { phoneticCoverage } from "./_qaEar";

type Fx = { f: string; lang: string; sentence: string; tx: string; txWhisper: string };
const FIXTURE: Fx[] = JSON.parse(readFileSync(join(__dirname, "_qa_fixture_transcripts.json"), "utf8"));
const LANG: Record<string, string> = { spa: "es", deu: "de" };

const BAD = [
  { lang: "es", label: "drop-final ES", sentence: "Un buen weveo no necesita durar, solo dejar huella.", tx: "Un buen hueveo no necesita durar, solo dejar" },
  { lang: "es", label: "truncado ES", sentence: "Nico se reía con el weveo cuático que se armaba.", tx: "Nico se reía con el hueveo cuático" },
  { lang: "es", label: "alucinada ES (caso mole 'gracias')", sentence: "Un buen weveo no necesita durar, solo dejar huella.", tx: "Un buen hueveo no necesita durar, solo dejar huella gracias" },
  { lang: "es", label: "drop-interna ES", sentence: "Brindó por el weveo aunque estén viejos y con guata.", tx: "Brindó por el hueveo aunque estén y con guata" },
  { lang: "de", label: "drop-interna DE", sentence: "Nadia bedankt sich, doch Ronny winkt nur ab.", tx: "Nadia bedankt sich, doch Ronnie winkt ab" },
  { lang: "de", label: "alucinada DE", sentence: "Nadia bedankt sich, doch Ronny winkt nur ab.", tx: "Nadia bedankt sich vielen Dank, doch Ronnie winkt nur ab" },
  { lang: "de", label: "truncado DE", sentence: "Er drückt ihr ein kleines Strüßjer in die Arme.", tx: "Er drückt ihr ein kleines Strüsjer" },
  { lang: "de", label: "swap palabra DE", sentence: "Hajanoi, gespart ist gespart, sagt Steffi.", tx: "Wunderbar, gespart ist gespart, sagt Steffi" },
];

let fails = 0;
console.log("=== takes buenos reales (deben PASAR) ===");
for (const c of FIXTURE) {
  const v = phoneticCoverage(c.sentence, c.tx, c.txWhisper, LANG[c.lang]);
  if (!v.ok) fails++;
  console.log(`${v.ok ? "PASS" : "FAIL !!"} ${c.f}${v.ok ? "" : `  → ${v.detail}`}`);
}
console.log("\n=== defectos sintéticos (deben RECHAZARSE) ===");
for (const c of BAD) {
  const v = phoneticCoverage(c.sentence, c.tx, c.tx, c.lang);
  if (v.ok) fails++;
  console.log(`${!v.ok ? "REJECT" : "PASSED !!"} ${c.label}${!v.ok ? `  → ${v.detail}` : ""}`);
}
console.log(fails === 0 ? "\nOK: 14/14 buenos pasan, 8/8 malos rechazados" : `\n${fails} desviación(es)`);
process.exit(fails === 0 ? 0 : 1);
