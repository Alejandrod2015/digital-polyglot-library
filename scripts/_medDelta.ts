import * as fs from "fs";
const A = JSON.parse(fs.readFileSync("/tmp/med-conjunto-main.json", "utf8"));
const B = JSON.parse(fs.readFileSync("/tmp/med-conjunto.json", "utf8"));
const key = (o: any) => o.id;
const mapA = new Map(A.map((o: any) => [key(o), o]));
for (const b of B) {
  const a: any = mapA.get(key(b));
  const st = (o: any) => new Map((o.checks ?? []).map((c: any) => [c.id, c.status]));
  const sa = st(a), sb = st(b);
  const diffs: string[] = [];
  for (const [id, s] of sb) if (sa.get(id) !== s) diffs.push(`${id}: main=${sa.get(id)} -> rama=${s}`);
  if (diffs.length) console.log(`${b.lang}/${b.variant} ${b.level} (${b.id})\n  ` + diffs.join("\n  "));
}
