import * as fs from "node:fs";
const textos = JSON.parse(fs.readFileSync("scripts/_b1/g/textos.json", "utf8")) as Record<string, string>;
const slug = process.argv[2];
const t = textos[slug];
// Trozos: se parte por coma, punto, dos puntos y comillas, que es donde acaba
// una unidad con sentido.
const trozos = t.split(/(?<=[,.;:”])\s+|\s+(?=“)/).map((x) => x.replace(/^[“”]|[“”]$/g, "").trim()).filter(Boolean);
const vistas = new Set<string>();
trozos.forEach((tr, i) => {
  const pal = (tr.toLowerCase().match(/[\p{L}]+/gu) ?? []).filter((w) => !vistas.has(w));
  pal.forEach((w) => vistas.add(w));
  if (pal.length) console.log(`${String(i).padStart(2)} | ${tr}\n     -> ${pal.join(" ")}`);
});
