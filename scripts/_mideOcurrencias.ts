// Mide cuantas palabras con `c` aparecen mas de una vez en la historia, y en
// cuantas de esas la frase de la segunda aparicion NO es la del `c` guardado.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";

const prisma = new PrismaClient();
type Entry = { c?: { es: string; en: string } };

const norm = (s: string) => s.toLowerCase().normalize("NFC");
const sentencesOf = (t: string) =>
  t.split(/(?<=[.!?…»"”])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

async function main() {
  const filas = await prisma.tapGlossSet.findMany({ where: { NOT: { slug: "" } } });
  const slugs = filas.map((f) => f.slug);
  const stories = await prisma.$queryRawUnsafe<{ slug: string; title: string; text: string; status: string; journeyId: string }[]>(
    `SELECT s."slug", s."title", s."text", j."status", s."journeyId" FROM "dp_journey_stories_v1" s JOIN "dp_journeys_v1" j ON j."id" = s."journeyId" WHERE s."slug" = ANY($1::text[])`,
    slugs
  );
  const bySlug = new Map(stories.map((s) => [s.slug, s]));

  let totalC = 0, repetidas = 0, colision = 0, historiasConCapa = 0, historiasAfectadas = 0;
  const porBundle: Record<string, { hist: number; afect: number; c: number; rep: number; col: number; status: string }> = {};
  const ejemplos: string[] = [];

  for (const f of filas) {
    const st = bySlug.get(f.slug);
    if (!st) continue;
    const glosses = f.glosses as Record<string, Entry>;
    const conC = Object.entries(glosses).filter(([, e]) => e.c);
    if (!conC.length) continue;
    historiasConCapa++;
    const b = (porBundle[f.bundle] ??= { hist: 0, afect: 0, c: 0, rep: 0, col: 0, status: st.status });
    b.hist++;
    const plain = norm(`${st.title}\n${extractStoryPlainText(st.text)}`);
    const sents = sentencesOf(plain);
    let afectada = false;
    for (const [w, e] of conC) {
      totalC++; b.c++;
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu");
      const n = (plain.match(re) ?? []).length;
      if (n < 2) continue;
      repetidas++; b.rep++;
      // frases que contienen la palabra; si alguna NO contiene el trozo `c.es`, esa aparicion recibe un contexto ajeno
      const cEs = norm(e.c!.es);
      const frases = sents.filter((s) => re.test(s) && (re.lastIndex = 0, true));
      const ajenas = frases.filter((s) => !s.includes(cEs));
      if (ajenas.length) {
        colision++; b.col++; afectada = true;
        if (ejemplos.length < 8) ejemplos.push(`${f.slug} | ${w} x${n} | c="${e.c!.es}" | ajena: "${ajenas[0].slice(0, 70)}"`);
      }
    }
    if (afectada) { historiasAfectadas++; b.afect++; }
  }

  console.log(`historias con capa: ${historiasConCapa}, afectadas: ${historiasAfectadas}`);
  console.log(`entradas con c: ${totalC}, palabra repetida: ${repetidas}, con colision real: ${colision}`);
  console.log("\nbundle | status | historias | afectadas | c | repetidas | colision");
  for (const [k, v] of Object.entries(porBundle).sort())
    console.log(`${k} | ${v.status} | ${v.hist} | ${v.afect} | ${v.c} | ${v.rep} | ${v.col}`);
  console.log("\nejemplos:"); ejemplos.forEach((e) => console.log("  " + e));
  await prisma.$disconnect();
}
main();
