// Solo lectura: techo de la lista ES A1/A2 contra las plazas del Friends ES spain A2.
import fs from "node:fs";
import { SPANISH_A1_A2_LEMMAS } from "../../src/lib/cefr/spanishA1A2";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const src = fs.readFileSync("src/lib/cefr/spanishA1A2.ts", "utf8");
const block = (a: string, b: string) => new Set((src.slice(src.indexOf(a), src.indexOf(b)).match(/"([^"]+)"/g) ?? []).map((s) => s.slice(1, -1)));
const funcion = block("── Function words", "── Time / frequency");
const numeros = block("── Numbers", "── Common abstract");
const adjs = block("── Adjectives", "── Adverbs");
const advs = block("── Adverbs", "── Numbers");
const vsrc = fs.readFileSync("src/lib/validateGeneratedStory.ts", "utf8");
const cog = new Set((vsrc.slice(vsrc.indexOf("  ES: [", vsrc.indexOf("COGNATES_BY_LANG")), vsrc.indexOf("  IT: [\"importante\"")).match(/"([^"]+)"/g) ?? []).map((s) => s.slice(1, -1)));
const norm = (w: string) => w.toLowerCase().trim().replace(/^(el|la|los|las|un|una)\s+/, "");
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
const tipoVisto = new Map<string, Map<string, number>>();
const bloqueadas = new Map<string, string>(); // anclada de Traveler spain
const friendsA1 = new Set<string>();
const traveler = new Set<string>();
for (const j of d.js) {
  if (j.language !== "spanish" || j.variant !== "spain") continue;
  for (const s of j.stories) for (const v of (s.vocab ?? [])) {
    if (!v?.word) continue;
    const w = norm(v.word); const t = String(v.type ?? "").toLowerCase();
    const m = tipoVisto.get(w) ?? new Map(); m.set(t, (m.get(t) ?? 0) + 1); tipoVisto.set(w, m);
    if (j.typeSlug === "relationships") friendsA1.add(w);
    else { traveler.add(w); if (!PORT.has(t)) bloqueadas.set(w, `${j.levels.join()}`); }
  }
}
const pos = (w: string) => {
  const m = tipoVisto.get(w); if (m) return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  if (/(ar|er|ir|ír)(se)?$/.test(w) && w.length > 3 && !w.includes(" ")) return "verb";
  if (adjs.has(w)) return "adjective"; if (advs.has(w)) return "adverb";
  if (w.includes(" ")) return "expression";
  return "noun";
};
const lemas = [...SPANISH_A1_A2_LEMMAS].filter((w) => !funcion.has(w) && !numeros.has(w) && w.length > 2);
const r = { total: lemas.length, cognados: 0, portLibres: [] as string[], portFriendsA1: [] as string[], anclLibres: [] as string[], anclFriendsA1: [] as string[], anclBloq: [] as string[] };
for (const w of lemas) {
  if (cog.has(w)) { r.cognados++; continue; }
  const p = PORT.has(pos(w));
  if (p) (friendsA1.has(w) || traveler.has(w) ? r.portFriendsA1 : r.portLibres).push(w);
  else if (bloqueadas.has(w)) r.anclBloq.push(w);
  else (friendsA1.has(w) ? r.anclFriendsA1 : r.anclLibres).push(w);
}
// Cuantas plazas ya ensenadas en spain caen DENTRO de lista
const ensenadas = [...new Set([...friendsA1, ...traveler])];
const dentro = ensenadas.filter((w) => isSpanishUpToLevel(w, "a2")).length;
console.log(`lemas de contenido en la lista: ${r.total} (cognados fuera: ${r.cognados})`);
console.log(`PORTABLES (verbo/adj/adv/expr) nunca ensenadas en spain: ${r.portLibres.length}`);
console.log(`PORTABLES ya ensenadas en spain (reabribles): ${r.portFriendsA1.length}`);
console.log(`ANCLADAS libres: ${r.anclLibres.length}`);
console.log(`ANCLADAS ensenadas solo por el Friends A1 (reabribles entre niveles): ${r.anclFriendsA1.length}`);
console.log(`ANCLADAS bloqueadas (Traveler spain; tope 2 por historia, objetivo 0): ${r.anclBloq.length}`);
console.log(`plazas ya ensenadas en spain: ${ensenadas.length}, de ellas dentro de lista A2: ${dentro}`);
fs.writeFileSync(process.argv[3], JSON.stringify(r, null, 1));
// Procedencia por bloque: nucleo (Cervantes/Routledge), ampliaciones A2, relleno regional/LATAM. Sin multipalabra.
const lines = src.split("\n");
const origen = new Map<string, string>();
lines.forEach((l, i) => {
  const n = i + 1; const o = n < 249 ? "nucleo" : n < 547 ? "ampliacion" : "regional";
  for (const m of l.matchAll(/"([^"]+)"/g)) if (!origen.has(m[1])) origen.set(m[1], o);
});
const tabla: Record<string, Record<string, number>> = {};
const add = (k: string, w: string) => { if (w.includes(" ")) return; const o = origen.get(w) ?? "?"; tabla[k] ??= {}; tabla[k][o] = (tabla[k][o] ?? 0) + 1; };
r.portLibres.forEach((w) => add("port libres", w)); r.portFriendsA1.forEach((w) => add("port reabribles", w));
r.anclLibres.forEach((w) => add("ancl libres", w)); r.anclFriendsA1.forEach((w) => add("ancl FriendsA1 reabribles", w)); r.anclBloq.forEach((w) => add("ancl bloqueadas", w));
console.table(tabla);
const muestra = (arr: string[], o: string) => arr.filter((w) => !w.includes(" ") && origen.get(w) === o);
console.log("ancl libres nucleo:", muestra(r.anclLibres, "nucleo").join(" "));
console.log("\nancl libres ampliacion (muestra 150):", muestra(r.anclLibres, "ampliacion").slice(0, 150).join(" "));
console.log("\nport libres nucleo+ampl:", [...muestra(r.portLibres, "nucleo"), ...muestra(r.portLibres, "ampliacion")].join(" "));
