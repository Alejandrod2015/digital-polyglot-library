/**
 * Presentacion de personajes ([[feedback_introduce_characters]]): en su PRIMERA
 * historia, cada uno tiene que entrar con un sintagma que diga QUE ES, y esa
 * presentacion tiene que caer antes de la primera linea citada, con tres frases
 * de narracion por delante (el lector reagrupa de tres en tres).
 *
 * El gate `narrator-intro-block-shared` de saveStory no lo ve en aleman: su
 * regex busca `Nombre, um/uma ...` y `Nombre é um ...`, o sea portugues.
 */
import * as fs from "fs";
const st = JSON.parse(fs.readFileSync("/tmp/final.json", "utf8")) as { slug: string; title: string; text: string }[];
const CAST = ["Hannah", "Elias", "Sophie", "Noah", "Emilia", "Leon", "Marie"];
// Los tres moldes aprobados, en aleman.
// El sintagma puede llevar determinante, posesivo y adjetivos antes del
// sustantivo ("Elias, ihren ältesten Freund", "eine alte Schulfreundin"), asi
// que el patron admite hasta dos adjetivos en minuscula antes del nucleo.
const DET = "(?:der|die|das|den|ein|eine|einen|einer|ihr|ihre|ihren|sein|seine|seinen)";
const NUC = `(?:[a-zäöüß]+\\s+){0,2}[A-ZÄÖÜ][a-zäöüß]+`;
const FORMAS: Array<[string, (n: string) => RegExp]> = [
  ["aposicion", (n) => new RegExp(`${n},\\s+${DET}\\s+${NUC}`, "u")],
  ["titulo + nombre", (n) => new RegExp(`(?:(?:Ihre?|Seine?)\\w*|[A-ZÄÖÜ][a-zäöüß]+s)\\s+\\w+\\s+${n}\\b`, "u")],
  ["con sein, frase propia", (n) => new RegExp(`\\b${n}\\s+ist\\s+(?:${DET}\\s+)?${NUC}`, "u")],
  ["con sein, pronombre", (n) => new RegExp(`\\b(?:Er|Sie)\\s+ist\\s+(?:${DET}\\s+)?${NUC}`, "u")],
];
for (const n of CAST) {
  const i = st.findIndex((s) => new RegExp(`\\b${n}\\b`, "u").test(s.text));
  if (i < 0) { console.log(`${n}: no aparece`); continue; }
  const t = st[i].text;
  const forma = FORMAS.find(([, re]) => re(n).test(t));
  const posPres = forma ? t.search(forma[1](n)) : -1;
  const posCita = t.indexOf("“");
  const antes = t.slice(0, posCita < 0 ? t.length : posCita);
  const frasesAntes = antes.split(/(?<=[.!?])\s+/).filter((f) => f.trim()).length;
  console.log(
    `${n.padEnd(7)} historia ${String(i + 1).padStart(2)}  forma: ${(forma?.[0] ?? "NINGUNA").padEnd(25)}` +
    ` presentado ${posPres < 0 ? "-" : posPres < posCita ? "ANTES" : "DESPUES"} de la 1a cita` +
    `  frases de narracion antes de la 1a cita: ${frasesAntes}`
  );
  if (forma) console.log(`   -> ${t.slice(Math.max(0, posPres - 20), posPres + 70).replace(/\n+/g, " ")}`);
}
