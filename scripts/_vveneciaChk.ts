import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const MAN: Record<string, number> = {
  "La Gondola Sussurrante":459,"Il Furto al Ballo in Maschera":589,"Il Fantasma del Ponte":507,
  "Il Manoscritto Perduto":542,"Il Violinista Silenzioso":513,"L’Enigma della Torre dell’Orologio":455,
  "Il Cristallo Maledetto":303,"Il Segreto Sotto la Basilica":416,"La Sirena di Murano":470,
  "Il Lamento della Laguna":362,"La Rosa Nera di Dorsoduro":442,"Il Lamento del Gondoliere":431,
  "Il Teatro Nascosto":409,"La Maschera del Tradimento":341,"Il Ritratto nella Nebbia":217,
  "L’Ultima Partitura della Fenice":333,"L’Ultimo Respiro del Campanile":478,"Il Libro dell’Abisso":450,
  "Le Ombre di Rialto":391,"Il Custode della Laguna":523,
};
async function main() {
  const rows = await prisma.catalogStory.findMany({
    where: { book: { slug: "italian-short-stories-from-mysterious-venice" } },
    select: { slug: true, title: true, text: true },
    orderBy: { position: "asc" },
  });
  console.log(`${"historia".padEnd(36)} ${"base".padStart(5)} ${"manusc".padStart(7)} ${"falta".padStart(6)} ${"%".padStart(6)}`);
  let rotas = 0;
  for (const r of rows) {
    const base = r.text.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const man = MAN[r.title];
    if (!man) { console.log(`${r.title.padEnd(36)} ${String(base).padStart(5)}  (sin manuscrito emparejado)`); continue; }
    const falta = man - base;
    const pct = (falta / man) * 100;
    const marca = pct > 8 ? "  <-- RECORTADA" : "";
    if (pct > 8) rotas++;
    console.log(`${r.title.padEnd(36)} ${String(base).padStart(5)} ${String(man).padStart(7)} ${String(falta).padStart(6)} ${pct.toFixed(0).padStart(5)}%${marca}`);
  }
  console.log(`\nrecortadas (>8% menos que el manuscrito): ${rotas} de ${rows.length}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
