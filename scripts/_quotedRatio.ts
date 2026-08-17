/**
 * Mide cuánto de una historia narrada va en habla citada: porcentaje de
 * PALABRAS dentro de comillas sobre el total del cuerpo, y número de citas.
 * El conteo de citas solo dice si hay o no; el porcentaje dice cuánta voz
 * tienen de verdad los personajes.
 *
 *   npx tsx scripts/_quotedRatio.ts <fichero.json> [etiqueta]
 *
 * El corpus usa CUATRO estilos de comillas: angulares «», bajas alemanas „…",
 * curvas “” y rectas "". La extracción va por orden y BORRA cada estilo antes
 * de pasar al siguiente; las rectas van al final porque el mismo carácter abre
 * y cierra, así que hay que emparejarlas por posición (1ª con 2ª, 3ª con 4ª) o
 * se acaba midiendo el texto que hay ENTRE citas en vez de las citas.
 */
import * as fs from "fs";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function quotedStats(text: string) {
  let rest = text;
  const quotes: string[] = [];

  for (const re of [/«([^»]*)»/g, /„([^""]*)["""]/g, /“([^”]*)”/g]) {
    for (const m of rest.matchAll(re)) quotes.push(m[1]);
    rest = rest.replace(re, " ");
  }

  // Rectas: mismo carácter para abrir y cerrar, así que se emparejan de dos en
  // dos. Una comilla suelta e impar se descarta en vez de tragarse el resto.
  const straight = rest.split('"');
  for (let i = 1; i < straight.length; i += 2) {
    if (i < straight.length - 1 || straight.length % 2 === 1) quotes.push(straight[i]);
  }

  const inside = quotes.reduce((n, q) => n + words(q), 0);
  const total = words(text);
  return { quotes: quotes.length, inside, total, pct: total ? (inside / total) * 100 : 0 };
}

if (require.main === module) {
  const file = process.argv[2];
  const label = process.argv[3] ?? file;
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as { slug: string; text: string }[];
  let ins = 0, tot = 0, q = 0, mudas = 0;
  for (const r of rows) {
    const s = quotedStats(r.text);
    ins += s.inside; tot += s.total; q += s.quotes;
    if (s.quotes === 0) mudas++;
    if (rows.length <= 5) console.log(`  ${r.slug.padEnd(26)} ${s.pct.toFixed(0).padStart(3)}% citado · ${s.quotes} citas`);
  }
  console.log(`${label}: ${((ins / tot) * 100).toFixed(1)}% de las palabras en habla citada · ${(q / rows.length).toFixed(1)} citas por historia · ${mudas}/${rows.length} mudas`);
}
