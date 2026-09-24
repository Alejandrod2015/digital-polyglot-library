import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("scripts/_esColombiaA0Friends/historias.json","utf8"));
const palabras: string[] = process.argv.slice(2);
const out: Record<string, string[]> = {};
for (const w of palabras) {
  const re = new RegExp("(^|[^a-zA-Z\\u00C0-\\u017F])" + w + "([^a-zA-Z\\u00C0-\\u017F]|$)", "i");
  const hits: string[] = [];
  for (const s of d.stories) {
    const txt = (s.title + ". " + (s.text||"")).replace(/\n+/g, " ");
    // partir por . ! ? manteniendo comillas
    for (const fr of txt.split(/(?<=[.!?])\s+/)) if (re.test(fr)) hits.push(s.slug + " :: " + fr.trim());
  }
  out[w] = hits;
}
for (const [w, hits] of Object.entries(out)) {
  console.log("### " + w + "  (" + hits.length + ")");
  for (const h of hits.slice(0,3)) console.log("   " + h);
}
