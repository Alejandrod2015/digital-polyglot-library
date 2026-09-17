// Solo lectura: que surfaces portables de temas anteriores vuelven en el texto de una tanda,
// con la tokenizacion del gate (surface en minusculas contra tokens del cuerpo), y la seguidilla
// de oraciones narradas cortas (<= 4 palabras) de la tanda.
//   npx tsx scripts/_itA1Friends/reencuentro.ts <tanda.json> <previa1.json> [previa2.json ...]
import { readFileSync } from "fs";
const tanda = JSON.parse(readFileSync(process.argv[2], "utf8"));
const previas = process.argv.slice(3).flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
const tok = (t: string) => new Set((t.toLowerCase().match(/\p{L}+/gu) ?? []));
const port = previas.flatMap((s: any) => s.vocab.filter((v: any) => !v.anchor).map((v: any) => ({ k: String(v.surface ?? v.word).toLowerCase(), de: `${s.topic}#${s.slotIndex}` })));
const cuerpos = tanda.map((s: any) => tok(s.text));
const vuelven = port.filter((p: any) => !p.k.includes(" ") && cuerpos.some((c: Set<string>) => c.has(p.k)));
const no = port.filter((p: any) => !vuelven.includes(p));
console.log(`portables de temas previos: ${port.length} · vuelven en la tanda: ${vuelven.length}`);
console.log("  vuelven:", vuelven.map((p: any) => `${p.k}(${tanda.map((s: any, i: number) => cuerpos[i].has(p.k) ? s.slotIndex + 1 : "").join("")})`).join(", "));
console.log("  no vuelven:", no.map((p: any) => p.k).join(", "));
// Misma medida que seguidillaNarrada de cierraTema.ts.
let cortas = 0, total = 0;
for (const s of tanda) {
  const narr = s.text.replace(/“[^”]*”|"[^"]*"/g, "");
  for (const o of narr.split(/(?<=[.!?…])\s+|\n+/)) {
    const n = (o.match(/[\p{L}\p{N}']+/gu) ?? []).length;
    if (!n) continue;
    total++; if (n <= 4) cortas++;
  }
}
console.log(`seguidilla: ${cortas}/${total} oraciones narradas de 4 palabras o menos (${Math.round(100 * cortas / total)}%)`);
// Misma medida que palabrasPorOracion de cierraTema.ts (techo 11 en a1), por historia y junta.
let P = 0, O = 0;
for (const s of tanda) {
  let p = 0, o = 0; const largas: string[] = [];
  for (const f of s.text.split(/(?<=[.!?…])\s+|\n+/)) {
    const n = (f.match(/[\p{L}\p{N}']+/gu) ?? []).length;
    if (!n) continue; o++; p += n; if (n > 14) largas.push(`${n}: ${f.slice(0, 60)}`);
  }
  P += p; O += o;
  console.log(`  ${s.slotIndex + 1}: ${(p / o).toFixed(1)} palabras por oracion; largas: ${largas.join(" | ") || "-"}`);
}
console.log(`densidad del tema: ${(P / O).toFixed(1)} (techo 11)`);
