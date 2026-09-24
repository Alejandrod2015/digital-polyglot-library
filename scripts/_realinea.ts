/** Re-alinea los tiempos de palabra de una historia contra su texto ACTUAL,
 *  usando el audio que ya existe. No sintetiza nada: no gasta creditos.
 *
 *  WHY: el lector con karaoke (HighlightedStoryContent) parte el texto por
 *  CADA salto de linea del payload de tiempos, que es una foto del texto
 *  tomada al alinear. Si el texto se reagrupa despues, el lector sigue
 *  pintando los parrafos viejos. Realinear refresca esa foto.
 *
 *  Tambien hace falta despues de empalmar un fragmento re-tirado
 *  (_rerollSection --apply), que avisa de que los tiempos quedan desfasados.
 *
 *  Uso:  npx tsx scripts/_realinea.ts [--journey <id>] [slug ...]
 *  Sin argumentos, el journey de siempre (Traveler ES A2 latam) entero; con
 *  slugs, solo esas historias. Ampliado el 2026-09-23 para el Friends DE A2. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
const p = new PrismaClient();
const A2_LATAM = "cmtgelq560007j84n3ujx9bpd";

(async () => {
  const i = process.argv.indexOf("--journey");
  const journeyId = i >= 0 ? process.argv[i + 1] : A2_LATAM;
  const jSlug = process.argv.indexOf("--slug");
  // `--slug <slug>` (la forma de la rama del Conversations) y los sueltos
  // posicionales valen igual; sin ninguno, el journey entero.
  const slugs = [
    ...(jSlug >= 0 && process.argv[jSlug + 1] ? [process.argv[jSlug + 1]] : []),
    ...process.argv.slice(2).filter((a, n, all) => !a.startsWith("--") && all[n - 1] !== "--journey" && all[n - 1] !== "--slug"),
  ];
  const ss = await p.journeyStory.findMany({
    where: {
      journeyId,
      NOT: { audioUrl: null },
      ...(slugs.length ? { slug: { in: slugs } } : {}),
    },
    select: { id: true, slug: true, text: true },
  });
  if (slugs.length && ss.length !== slugs.length) {
    throw new Error(`pedidas ${slugs.length} historias y encontradas ${ss.length} con audio en ese journey`);
  }
  for (const s of ss) {
    const pars = (s.text || "").split(/\n\n+/).length;
    try { await generateWordTimingsForStory(s.id); console.log(`${s.slug.padEnd(26)} realineada · ${pars} parrafos`); }
    catch (e: any) { console.warn(`${s.slug.padEnd(26)} FALLO: ${e.message?.slice(0, 110)}`); }
  }
})().finally(() => p.$disconnect());
