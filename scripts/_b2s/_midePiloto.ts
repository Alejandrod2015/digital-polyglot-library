/** Antes/despues del piloto: palabras, % citado, sonda canonica (mismas regex que _gramProbe), reparto de vocab por bloque. */
import { readFileSync } from "fs";
const RE: Array<[string, RegExp]> = [
  ["pret", /\b[a-zá-ú]+(ó|aron|ieron)\b|\b(fue|fueron|tuvo|hizo|dijo|vino|dio|puso|quiso)\b/gi],
  ["impf", /\b[a-zá-ú]+(aba|aban)\b|\b(era|eran|iba|iban|tenía|tenían|había|hacía|decía|veía|quería|podía|sabía|venía)\b/gi],
  ["cond", /\b[a-zá-ú]+(ría|rían|ríamos)\b/gi],
  ["subjP", /\b(sea|sean|tenga|tengan|haya|hagan|pueda|puedan|venga|vengan|quiera|diga|vaya)\b/gi],
  ["subjI", /\b(?!para\b|cara\b|clara\b|rara\b|vara\b|tara\b|jara\b|mara\b)[a-zá-ú]+(ara|aran|iera|ieran|ase|asen|iese|iesen)\b/gi],
  ["estInd", /\b(dijo|contó|explicó|preguntó|respondió|avisó)\s+(que|si)\b/gi],
];
for (const f of process.argv.slice(2)) {
  const st = JSON.parse(readFileSync(f, "utf8"));
  const todo = st.map((s: any) => s.text).join("\n");
  const fr = todo.replace(/\n+/g, " ").split(/(?<=[.!?”"])\s+/).filter((x: string) => x.trim().length > 1).length;
  console.log(`\n### ${f} (${fr} oraciones) -> ` + RE.map(([n, re]) => `${n} ${Math.round((100 * (todo.match(re) ?? []).length) / fr)}`).join(" · "));
  for (const s of st) {
    const pal = s.text.trim().split(/\s+/).length;
    const cit = (s.text.match(/“[^”]*”/g) ?? []).join(" ").replace(/[“”]/g, "").trim().split(/\s+/).filter(Boolean).length;
    const bloques = s.text.split(/\n\s*\n/);
    const reparto = bloques.map((b: string) => s.vocab.filter((v: any) => b.toLowerCase().includes(String(v.surface ?? v.word).toLowerCase())).length);
    console.log(`  #${s.slotIndex} ${s.title}: ${pal} palabras · citado ${Math.round((100 * cit) / pal)}% · ${bloques.length} parrafos · vocab/bloque [${reparto.join(",")}] (tope ${Math.floor(0.3 * s.vocab.length)})`);
  }
}
