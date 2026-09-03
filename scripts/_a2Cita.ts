import * as fs from "fs";
const O = "“", C = "”";
const w = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const c = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
for (const s of c) {
  let inside = 0;
  for (const m of String(s.text).matchAll(new RegExp(`${O}([^${C}]*)${C}`, "g"))) inside += w(m[1]);
  const tot = w(s.text);
  console.log(`${(inside/tot*100).toFixed(0)}%  ${inside}/${tot}  ${s.title}`);
}
