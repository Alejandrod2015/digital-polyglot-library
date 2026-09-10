/** Filas sin gate (none) del inventario, con la fecha de su memoria: las mas nuevas son las que suben el trinquete. */
import * as fs from "fs";
import * as path from "path";
const inv = JSON.parse(fs.readFileSync("docs/rules-inventory.json", "utf8"));
const dir = "/Users/alejandrodelcarpio/.claude/projects/-Users-alejandrodelcarpio-digital-polyglot-library/memory";
const filas = inv.rules.filter((r: any) => r.gate === "none").map((r: any) => {
  const f = String(r.source).startsWith("memory:") ? path.join(dir, String(r.source).slice(7)) : "";
  const m = f && fs.existsSync(f) ? fs.statSync(f).mtime.toISOString().slice(0, 16) : "(no es memoria)";
  return { m, id: r.id, src: r.source };
}).sort((a: any, b: any) => b.m.localeCompare(a.m));
console.log(`${filas.length} filas none; las 10 memorias mas recientes:`);
for (const x of filas.slice(0, 10)) console.log(`  ${x.m}  ${x.id}`);
const base = JSON.parse(fs.readFileSync("docs/rules-inventory-baseline.json", "utf8"));
console.log(`linea base: none ${base.none}`);
