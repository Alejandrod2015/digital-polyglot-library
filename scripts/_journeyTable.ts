/**
 * Tabla de estado de un journey, una fila por historia.
 *
 * POR QUÉ: al cerrar cada tema hace falta ver el journey entero de un vistazo,
 * y las dos columnas que importan (vocabulario repetido fuera y dentro) solo se
 * pueden calcular contra la base, no contra las notas del chat.
 *
 *   npx tsx --conditions react-server scripts/_journeyTable.ts <journeyId>
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const J = process.argv[2] ?? "cmsyrge55000732u9oiu8wue3";
const NOM: Record<string, string> = { manaus: "Manaus", florianopolis: "Florianópolis", "foz-do-iguacu": "Foz do Iguaçu", olinda: "Olinda", belem: "Belém", pantanal: "Pantanal", "ouro-preto": "Ouro Preto" };
async function main() {
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true, language: true } });
  const orden = j?.topics ?? [];
  const rows = await p.journeyStory.findMany({ where: { journeyId: J }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  const otras = await p.journeyStory.findMany({ where: { journey: { language: j?.language }, journeyId: { not: J } }, select: { vocab: true } });
  const fuera = new Set<string>();
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) fuera.add(String(v.word).toLowerCase());
  const hechas = rows.filter((r) => r.text);
  const cuenta = new Map<string, number>();
  for (const r of hechas) for (const v of ((r.vocab as any[]) ?? [])) {
    const w = String(v.word).toLowerCase(); cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
  }
  console.log("| Tema | # | Historia | Arco | Pal. | Citado | Vocab | Ya en otro journey | Ya en este journey | Sale Matheus | Portada | Audio |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
  const temas = orden.length ? orden : [...new Set(rows.map((r) => r.topic))];
  for (const t of temas) for (const r of rows.filter((x) => x.topic === t)) {
    const nom = NOM[t] ?? t;
    if (!r.text) { console.log(`| ${nom} | ${r.slotIndex + 1} | (vacío) | | | | | | | | | |`); continue; }
    const w = r.text.split(/\s+/).length;
    const cit = [...r.text.matchAll(/[“]([^”]*)[”]/g)].reduce((a, m) => a + m[1].split(/\s+/).length, 0);
    const voc = (r.vocab as any[]) ?? [];
    const off = voc.filter((v) => fuera.has(String(v.word).toLowerCase())).map((v) => v.word);
    const rep = voc.filter((v) => (cuenta.get(String(v.word).toLowerCase()) ?? 0) > 1).map((v) => v.word);
    console.log(`| ${nom} | ${r.slotIndex + 1} | ${r.title} | ${(r as any).arcType} | ${w} | ${Math.round((100 * cit) / w)}% | ${voc.length} | ${off.join(", ") || "0"} | ${rep.join(", ") || "0"} | ${/Matheus/.test(r.text) ? "sí" : "-"} | ${(r as any).coverImageUrl ? "sí" : "no"} | ${(r as any).audioUrl ? "sí" : "no"} |`);
  }
  console.log(`\nhistorias ${hechas.length}/${rows.length} · Matheus ${hechas.filter((r) => /Matheus/.test(r.text!)).length} · píldoras ${[...cuenta.values()].reduce((a, b) => a + b, 0)}, distintas ${cuenta.size}`);
  await p.$disconnect();
}
main();
