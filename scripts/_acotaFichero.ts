import fs from "node:fs";
const CITA = /“([^”]+)”/g;
const pal = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; text: string; topic?: string }>;
const solo = process.argv.slice(3);
let citados = 0, con = 0;
for (const s of d) {
  if (solo.length && !solo.some((x) => (s.topic ?? "") === x || s.slug === x)) continue;
  const ps = s.text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  let malos = 0;
  ps.forEach((x, i) => {
    if (!CITA.test(x)) { CITA.lastIndex = 0; return; }
    CITA.lastIndex = 0;
    citados++;
    const propia = pal(x.replace(CITA, " ")) >= 2;
    const previa = i > 0 && !/“/.test(ps[i - 1]);
    if (propia || previa) con++; else malos++;
  });
  if (malos) console.log(`${s.slug}: ${malos} párrafo(s) citado(s) sin narrador al lado`);
}
console.log(`${citados} párrafos citados · con narrador al lado ${Math.round((con / citados) * 100)}%`);
