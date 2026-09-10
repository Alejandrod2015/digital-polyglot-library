/** Riqueza de prosa de un tema en JSON: % de palabras DISTINTAS por encima de A1/A2 (mismo criterio que riquezaProsa). */
import { readFileSync } from "fs";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { spanishInfinitiveOf } from "../../src/lib/cefr/spanishConjugations";
for (const f of process.argv.slice(2)) {
  const st = JSON.parse(readFileSync(f, "utf8"));
  const texto = st.map((s: any) => s.text.replace(/[“”]/g, " ")).join(" ");
  const propios = new Set((texto.match(/(?<=[a-záéíóúñ,;:]\s)[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/gu) ?? []).map((w: string) => w.toLowerCase()));
  const toks = [...new Set((texto.toLowerCase().match(/[a-záéíóúüñ]{3,}/g) ?? []))].filter((w) => !propios.has(w));
  const alto = toks.filter((w) => { const inf = spanishInfinitiveOf(w); return !isSpanishUpToLevel(w, "a2") && !(inf && isSpanishUpToLevel(inf, "a2")); });
  console.log(`${f.split("/").pop()}: ${Math.round((100 * alto.length) / toks.length)}% de ${toks.length} distintas sobre A1/A2`);
}
