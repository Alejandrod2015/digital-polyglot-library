// SOLO LECTURA. Para la pasada de escalera: las portables con un solo
// encuentro (mismo calculo que journey-vocab-recirculation), de que historia
// son, y el margen de cada historia (palabras hasta 145, citado 25-35%).
//   npx tsx scripts/_frA0/sueltos.ts
import fs from "fs";
const temas = ["t1","t2","t3","t4","t5","t6","t7"];
const st = temas.flatMap((t) => JSON.parse(fs.readFileSync(`scripts/_frA0/${t}.json`, "utf8")).map((s: any) => ({ ...s, tf: t })));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = st.map((s: any) => new Set(tok(s.text)));
const textos = st.map((s: any) => s.text.toLowerCase());
const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
const enc = (v: any) => { const k = clave(v); if (!k.includes(" ")) return cuerpos.filter((c) => c.has(k)).length;
  const lema = String(v.word).toLowerCase(); return textos.filter((t) => t.includes(k) || t.includes(lema)).length; };
const words = (t: string) => (t.match(/[A-Za-zÀ-ÿœ'’-]+/g) ?? []).length;
const quoted = (t: string) => [...t.matchAll(/“([^”]*)”/g)].reduce((n, m) => n + words(m[1]), 0);
let port = 0, suma = 0; const sueltos: string[] = [];
st.forEach((s: any, i: number) => {
  const mios = (s.vocab ?? []).filter((v: any) => !v.anchor).map((v: any) => ({ k: clave(v), w: v.word, n: enc(v) }));
  port += mios.length; suma += mios.reduce((a: number, b: any) => a + b.n, 0);
  const solos = mios.filter((x: any) => x.n <= 1);
  const w = words(s.text), q = quoted(s.text);
  console.log(`${s.tf}#${s.slotIndex} ${s.title.padEnd(26)} ${w} pal (margen ${145 - w}) · citado ${Math.round(100 * q / w)}% · sueltos ${solos.length}: ${solos.map((x: any) => x.k).join(", ")}`);
  sueltos.push(...solos.map((x: any) => x.k));
});
console.log(`\nportables ${port} · media ${(suma / port).toFixed(2)} (suelo 2.5 => faltan ${Math.max(0, Math.ceil(2.5 * port - suma))} encuentros) · sueltos ${sueltos.length} (tope 30% => max ${Math.floor(0.3 * port)})`);
