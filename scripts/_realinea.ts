/** Re-alinea los tiempos de palabra de una historia contra su texto ACTUAL,
 *  usando el audio que ya existe. No sintetiza nada: no gasta creditos.
 *
 *  WHY: el lector con karaoke (HighlightedStoryContent) parte el texto por
 *  CADA salto de linea del payload de tiempos, que es una foto del texto
 *  tomada al alinear. Si el texto se reagrupa despues, el lector sigue
 *  pintando los parrafos viejos. Realinear refresca esa foto. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmtgelq560007j84n3ujx9bpd", NOT: { audioUrl: null } },
    select: { id: true, slug: true, text: true },
  });
  for (const s of ss) {
    const pars = (s.text || "").split(/\n\n+/).length;
    try { await generateWordTimingsForStory(s.id); console.log(`${s.slug.padEnd(26)} realineada · ${pars} parrafos`); }
    catch (e: any) { console.warn(`${s.slug.padEnd(26)} FALLO: ${e.message?.slice(0, 110)}`); }
  }
})().finally(() => p.$disconnect());
