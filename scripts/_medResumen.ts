import * as fs from "fs";
import { execSync } from "child_process";
const B = JSON.parse(fs.readFileSync("/tmp/med-conjunto.json", "utf8"));
const rows: any[] = [];
for (const j of B) {
  const f = (j.checks ?? []).filter((c: any) => c.status === "fail").map((c: any) => c.id);
  const ni = (j.checks ?? []).filter((c: any) => c.status === "not-implemented").map((c: any) => c.id);
  const pend = (j.checks ?? []).filter((c: any) => c.status === "pending-set").map((c: any) => c.id);
  const file = `/tmp/med/${j.id}.canon.txt`;
  let canonFail = 0; const reglas: Record<string, number> = {};
  if (fs.existsSync(file)) {
    const txt = fs.readFileSync(file, "utf8");
    canonFail = (txt.match(/^=== FAIL/gm) ?? []).length;
    for (const m of txt.matchAll(/^   FAIL \[([a-z0-9-]+)\]/gm)) { const id = m[1]; if (id.startsWith("journey-")) continue; reglas[id] = (reglas[id] ?? 0) + 1; }
  }
  rows.push({ id: j.id, lang: j.lang, variant: j.variant, level: j.level, tipo: j.tipo, n: j.n, plazas: j.plazas,
    setFail: f, setNI: ni, setPend: pend, canonFail, canonReglas: reglas });
}
rows.sort((a, b) => (b.canonFail + b.setFail.length * 3) - (a.canonFail + a.setFail.length * 3));
fs.writeFileSync("/tmp/med-resumen.json", JSON.stringify(rows, null, 1));
for (const r of rows) {
  const top = Object.entries(r.canonReglas).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(", ");
  console.log(`${r.lang}/${r.variant} ${r.level} ${r.tipo} | ${r.n}/${r.plazas} | conjunto-FAIL: ${r.setFail.join(", ") || "-"} | canon: ${r.canonFail} hist | ${top || "-"} | ciegas: ${r.setNI.join(",") || "-"}`);
}
