import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const RE: Array<[string, RegExp]> = [
  ["pretérito", /\b[a-zá-ú]+(ó|aron|ieron)\b|\b(fue|fueron|tuvo|hizo|dijo|vino|dio|puso|quiso)\b/gi],
  // -ía fuera: "día", "policía", "panadería" la disparaban. Solo -aba/-aban
  // y la lista cerrada de irregulares frecuentes.
  ["imperfecto", /\b[a-zá-ú]+(aba|aban)\b|\b(era|eran|iba|iban|tenía|tenían|había|hacía|decía|veía|quería|podía|sabía|venía)\b/gi],
  ["condicional", /\b[a-zá-ú]+(ría|rían|ríamos)\b/gi],
  ["subj. presente", /\b(sea|sean|tenga|tengan|haya|hagan|pueda|puedan|venga|vengan|quiera|diga|vaya)\b/gi],
  // "para", "cara", "clara" y "vara" NO son subjuntivos; sin esta exclusión
  // el A0 mexicano marcaba 14 por cada 100 oraciones.
  ["subj. imperfecto", /\b(?!para\b|cara\b|clara\b|rara\b|vara\b|tara\b|jara\b|mara\b)[a-zá-ú]+(ara|aran|iera|ieran|ase|asen|iese|iesen)\b/gi],
  ["pasiva", /\b(fue|fueron)\s+[a-zá-ú]+(ado|ada|ados|adas|ido|ida|idos|idas)\b/gi],
  ["estilo indirecto", /\b(dijo|contó|explicó|preguntó|respondió|avisó)\s+(que|si)\b/gi],
  ["conectores", /\b(sin embargo|en cambio|de hecho|aun así|por más que|mientras que|a pesar de|de modo que|así que)\b/gi],
];
async function main() {
  for (const id of process.argv.slice(2)) {
    const j = await p.journey.findUnique({ where: { id }, select: { name: true, variant: true, levels: true } });
    const rows = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { text: true } });
    const t = rows.map((r) => r.text!).join("\n");
    const fr = t.replace(/\n+/g, " ").split(/(?<=[.!?”"])\s+/).filter((f) => f.trim().length > 1).length;
    const out = RE.map(([n, re]) => `${n} ${Math.round((100 * (t.match(re) ?? []).length) / fr)}`).join(" · ");
    console.log(`${(j?.levels ?? []).join("/")} ${j?.name} ${j?.variant} (${fr} or.) -> ${out}`);
  }
  await p.$disconnect();
}
main();
