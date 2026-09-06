import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const p = new PrismaClient();
const MIO = "cmt5x67ze000l320cpgunu5vi";
const C = `recibo contrato firma sello copia carpeta grifo ducha lavadora nevera fregadero cocina
persiana ventana patio ruido vecino escalera portal timbre caja cinta bombilla llave cable manta
almohada sábana toalla percha estante silla mesa alfombra horario norma permiso aviso arreglo basura
reciclaje factura luz agua gas alquiler casero habitación mudanza colchón calefacción ascensor
portátil sala acta resumen agenda pantalla enchufe altavoz tranvía andén taquilla mochila beca
matrícula aula`.split(/\s+/).filter(Boolean);
(async () => {
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" }, variant: "spain", status: { not: "archived" } }, select: { id: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: { in: js.map((x) => x.id) } }, select: { journeyId: true, vocab: true } });
  const ajeno = new Set<string>();
  for (const r of rows) if (r.journeyId !== MIO)
    for (const v of ((r.vocab as Array<{ word: string }>) ?? [])) ajeno.add(v.word.toLowerCase().trim());
  const libre = C.filter((w) => !ajeno.has(w) && isSpanishUpToLevel(w, "b1"));
  const fuera = C.filter((w) => ajeno.has(w) || !isSpanishUpToLevel(w, "b1"));
  console.log(`USABLES (${libre.length}): ${libre.join(", ")}`);
  console.log(`\nDESCARTADAS (${fuera.length}): ${fuera.join(", ")}`);
  await p.$disconnect();
})();
