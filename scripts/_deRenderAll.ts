/** Lineas citadas partidas por el reagrupado del lector, en TODO el catalogo. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { renderedParagraphs } from "@/lib/readerParagraphs";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({
    where: { text: { not: null }, journey: { status: { not: "archived" } } },
    select: { slug: true, text: true, journey: { select: { language: true, name: true } } },
  });
  const cuenta = new Map<string, number>();
  for (const s of st) {
    for (const b of renderedParagraphs(String(s.text))) {
      // Cada estilo de comilla se mira por separado y solo si la HISTORIA lo
      // usa: si no, un cuerpo con curvas salia marcado por las bajas alemanas.
      const roto = ([a, c]: string, texto: string) =>
        texto.includes(a) && (b.split(a).length - 1) !== (b.split(c).length - 1);
      const par = ["“”", "«»"].some((q) => roto(q, String(s.text)));
      if (par) {
        const k = `${s.journey?.language}/${s.journey?.name}`;
        cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
      }
    }
  }
  console.log(`historias revisadas: ${st.length}`);
  for (const [k, v] of [...cuenta].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  if (!cuenta.size) console.log("  ninguna linea citada partida en todo el catalogo");
  await p.$disconnect();
})();
