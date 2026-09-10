import * as fs from "node:fs";
const t = (JSON.parse(fs.readFileSync("scripts/_b2/t3.json","utf8")) as any[])[0].text as string;
const SAY = "dice|dijo|pregunta|preguntó|contesta|contestó|responde|respondió|añade|añadió|grita|gritó|susurra|repite|repitió|explica|explicó|diz|disse|perguntou|respondeu|avisa|avisou|repetiu|conta|contou|gritou|chama|chamou|pede|pediu|ensina|ensinou|escreve|escreveu";
for (const re of [
  new RegExp(`(?:${SAY})\\s+([\\p{Lu}][\\p{Ll}]+)`, "gu"),
  new RegExp(`([\\p{Lu}][\\p{Ll}]+)\\s+(?:${SAY})`, "gu"),
  new RegExp(`(?:${SAY})\\s+(?:el|la|un|una)\\s+([\\p{Ll}]+)`, "gu"),
  new RegExp(`(?:el|la|un|una)\\s+([\\p{Ll}]+)\\s+(?:${SAY})`, "gu"),
]) for (const m of t.matchAll(re)) console.log(re.source.slice(0,30), "->", m[1], "|", t.slice(Math.max(0,m.index!-30), m.index!+30).replace(/\n/g," "));
