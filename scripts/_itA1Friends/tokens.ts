// Solo lectura: cada palabra de contenido de las historias de un fichero de tanda, con
// su estado para plaza: en lista (italianA1A2), ensenada en otro journey italiano (type), y conteos.
//   npx tsx scripts/_itA1Friends/tokens.ts <all.json> <tN-data.json>
import { readFileSync } from "fs";
import { isItalianA1A2 } from "../../src/lib/cefr/italianA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const strip = (w: string) => w.toLowerCase().trim().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l'|un')/, "");
const tipos = new Map<string, Set<string>>();
for (const j of d.js.filter((j: any) => j.language === "italian"))
  for (const s of j.stories) for (const v of s.vocab ?? []) {
    const k = strip(String(v.word)); if (!tipos.has(k)) tipos.set(k, new Set()); tipos.get(k)!.add(`${v.type}@${j.name}${j.levels[0]}`);
  }
const tanda = JSON.parse(readFileSync(process.argv[3], "utf8"));
for (const s of tanda) {
  const words = s.text.replace(/[“”]/g, " ").split(/\s+/).filter(Boolean);
  const citado = (s.text.match(/“[^”]*”/g) ?? []).join(" ").split(/\s+/).filter((w: string) => /\p{L}/u.test(w)).length;
  const frases = s.text.split(/(?<=[.!?])\s+/).map((f: string) => f.split(/\s+/).filter((w: string) => /\p{L}/u.test(w)).length);
  const med = [...frases].sort((a, b) => a - b)[Math.floor(frases.length / 2)];
  console.log(`\n### ${s.topic}#${s.slotIndex} ${s.title} | ${words.length} palabras | citado ${Math.round(100 * citado / words.length)}% | parrafos ${s.text.split(/\n\n/).length} | mediana ${med} max ${Math.max(...frases)}`);
  if (s.vocab?.length) {
    const fuera = s.vocab.filter((v: any) => !isItalianA1A2(v.word));
    const ancl = s.vocab.filter((v: any) => v.anchor).length;
    const noEsta = s.vocab.filter((v: any) => !new RegExp(`(?<!\\p{L})${String(v.surface ?? v.word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "u").test(s.text));
    const bloq = s.vocab.filter((v: any) => { const t = tipos.get(strip(v.word)); return t && [...t].some((x) => x.startsWith("noun")); });
    console.log(`  vocab ${s.vocab.length} | fuera de lista ${fuera.length}: ${fuera.map((v: any) => v.word).join(", ")} | ancladas ${ancl} | surface ausente: ${noEsta.map((v: any) => v.surface ?? v.word).join(", ") || "-"} | nombre ya ensenado: ${bloq.map((v: any) => v.word).join(", ") || "-"}`);
  } else {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of s.text.toLowerCase().match(/\p{L}+(?:'\p{L}+)?/gu) ?? []) {
      if (seen.has(w)) continue; seen.add(w);
      const t = tipos.get(w);
      out.push(`${w}${isItalianA1A2(w) ? "" : "*"}${t ? "[" + [...t].map((x) => x.split("@")[0][0]).join("") + "]" : ""}`);
    }
    console.log("  " + out.join(" "));
  }
}
