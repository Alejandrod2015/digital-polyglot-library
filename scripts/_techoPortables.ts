/** Techo real del reparto: cuántas plazas son de escena (palabra local, fuera
 *  del léxico A1/A2 general) y por tanto no pueden recircular, y cuántas son
 *  genéricas y sí. */
import fs from "node:fs";
import { PORTUGUESE_A1_A2_LEMMAS } from "../src/lib/cefr/portugueseA1A2";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; text: string; vocab: Array<{ word: string; surface?: string; anchor?: boolean }> }>;
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = d.map((s) => new Set(tok(s.text)));
const sup = (v: { word: string; surface?: string }) => String(v.surface ?? v.word).toLowerCase();
let escena: string[] = [], generica: string[] = [], recirculan = 0;
for (const s of d) for (const v of s.vocab) {
  const n = cuerpos.filter((c) => c.has(sup(v))).length;
  if (n > 1) recirculan++;
  (PORTUGUESE_A1_A2_LEMMAS.has(v.word.toLowerCase()) ? generica : escena).push(v.word);
}
const total = d.reduce((a, s) => a + s.vocab.length, 0);
console.log(`plazas ${total} · recirculan hoy ${recirculan} (${Math.round(recirculan / total * 100)}%)`);
console.log(`de escena (fuera del lexico A1/A2 general) ${escena.length} (${Math.round(escena.length / total * 100)}%)`);
console.log(`genericas, pueden recircular ${generica.length} (${Math.round(generica.length / total * 100)}%)`);
console.log(`\nmuestra de escena: ${escena.slice(0, 24).join(" ")}`);
