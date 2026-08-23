/** Solo la prosa: palabras, habla citada y palabras del nucleo. Sin vocab. */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const N = fs.readFileSync("scripts/_b1/nucleo.txt", "utf8").split(/\r?\n/).filter(Boolean);
const W = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const tok = (t: string) => new Set(t.toLowerCase().match(/\p{L}+/gu) ?? []);
const q = (t: string) => { let n = 0; for (const m of t.matchAll(/“([^”]*)”/g)) n += W(m[1]); return (n / W(t)) * 100; };
for (const s of S) {
  const c = tok(s.text); const n = N.filter((w) => c.has(w)).length;
  const w = W(s.text), qq = q(s.text);
  const mal = [w < 115 || w > 170 ? `${w}w` : "", qq < 25 || qq > 35 ? `cita ${qq.toFixed(0)}%` : "", n < 24 ? `nucleo ${n}` : ""].filter(Boolean);
  console.log(`${mal.length ? "FAIL" : "ok  "} ${String(s.topic + "#" + s.slotIndex).padEnd(30)} ${w}w cita ${qq.toFixed(0)}% nucleo ${n}${mal.length ? "   <- " + mal.join(", ") : ""}`);
}
