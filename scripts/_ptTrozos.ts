/** Propone el trozo de contexto de cada plaza: la clausula literal donde cae la
 *  palabra, recortada al tope. La traduccion al ingles se escribe a mano. */
import * as fs from "fs";
const d = JSON.parse(fs.readFileSync(process.env.F!, "utf8"));
const idx = Number(process.env.I ?? "0");
const s = d[idx];
const texto = String(s.text).replace(/\n\n/g, " ");
const out: Record<string, string> = {};
for (const v of s.vocab) {
  const sup = v.surface ?? v.word;
  const trozos = texto.split(/(?<=[.!?;:,”“])\s*|\s*(?=[“”])/).filter(Boolean);
  let mejor = trozos.find((t: string) => t.includes(sup)) ?? sup;
  mejor = mejor.replace(/^[“”,.;:\s]+|[“”,.;:\s]+$/g, "");
  let ws = mejor.split(/\s+/);
  if (ws.length > 6) {
    const p = ws.findIndex((w: string) => w.includes(sup.split(" ")[0]));
    const ini = Math.max(0, Math.min(p - 2, ws.length - 6));
    ws = ws.slice(ini, ini + 6);
  }
  out[sup] = ws.join(" ");
}
console.log(JSON.stringify({ slug: s.slug, trozos: out }, null, 1));
