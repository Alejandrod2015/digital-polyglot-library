/**
 * Cambia entradas de vocabulario de una historia del catalogo: quita las
 * indicadas y anade otras, manteniendo la densidad. Un swap, no un recorte.
 *
 *   npx tsx scripts/_vswap.ts <swap.json> [--apply]
 *   swap.json = { "<slug>": { "quitar": ["..."], "anadir": [ {word,surface?,type,definition} ] } }
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function raiz(w: string) {
  return w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(arse|erse|irse|ar|er|ir|os|as|es|s)$/, "");
}

async function main() {
  const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
  let fallos = 0;

  for (const [slug, plan] of Object.entries<any>(data)) {
    const row = await prisma.catalogStory.findFirst({ where: { slug }, select: { id: true, text: true, vocab: true } });
    if (!row) { console.log(`${slug}: NO EXISTE`); fallos++; continue; }
    const v = (row.vocab as any[]) || [];
    const plain = row.text.replace(/<[^>]+>/g, " ");
    const low = plain.toLowerCase();

    const quitar = new Set<string>(plan.quitar ?? []);
    const restantes = v.filter((e) => !quitar.has(String(e.surface || e.word)));
    const noEncontradas = [...quitar].filter((q) => !v.some((e) => String(e.surface || e.word) === q));
    const nuevo = [...restantes, ...(plan.anadir ?? [])];

    const problemas: string[] = [];
    for (const q of noEncontradas) problemas.push(`no existe la entrada a quitar: ${q}`);
    if (restantes.length !== v.length - quitar.size) problemas.push("el recuento de quitadas no cuadra");
    const vistas = new Set<string>();
    for (const e of nuevo) {
      const forma = String(e.surface || e.word);
      const d = String(e.definition || "");
      if (!low.includes(forma.toLowerCase())) problemas.push(`sin literal en el texto: ${forma}`);
      if (vistas.has(forma.toLowerCase())) problemas.push(`forma duplicada: ${forma}`);
      vistas.add(forma.toLowerCase());
      if (d.trim().split(/\s+/).length < 4) problemas.push(`definicion corta: ${forma}`);
      const r = raiz(String(e.word));
      if (r.length >= 4 && d.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(r)) problemas.push(`repite la palabra: ${forma}`);
    }
    const palabras = plain.split(/\s+/).filter(Boolean).length;
    const nouns = nuevo.filter((e) => e.type === "noun").length;
    console.log(
      `${slug.padEnd(30)} ${v.length} -> ${nuevo.length} entradas | densidad ${((nuevo.length / palabras) * 100).toFixed(1)}% | sustantivos ${Math.round((nouns / nuevo.length) * 100)}% | ${problemas.length ? "FALLA" : "OK"}`
    );
    for (const p of problemas) console.log(`    ${p}`);
    if (problemas.length) { fallos++; continue; }
    if (APPLY) await prisma.catalogStory.update({ where: { id: row.id }, data: { vocab: nuevo as never } });
  }

  console.log(fallos ? `\n${fallos} con fallos, no escribi esas` : APPLY ? "\naplicado" : "\n(dry run, usa --apply)");
  await prisma.$disconnect();
  if (fallos) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
