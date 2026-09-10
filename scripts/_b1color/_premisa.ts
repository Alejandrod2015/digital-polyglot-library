/** Comprueba la premisa del encargo antes de tocar 19 plazas: que cada palabra
 *  que sale del vocab aparezca UNA SOLA VEZ en su historia, que es la prueba
 *  practica de la regla afinada (si sale una vez y la escena funciona sin
 *  ella, es paisaje). Y de paso lista las candidatas transferibles que ya
 *  estan en ese cuerpo, que es de donde tiene que salir el reemplazo.
 *
 *  Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";

const p = new PrismaClient();
const JOURNEY = "cmtmylg7k0007321h6t7njesx";

const FUERA: Record<string, string[]> = {
  "el-pretexto-armado": ["zonda"],
  "un-tinto-que-nadie-pidio": ["bahareque", "carriel", "aguapanela", "chiva"],
  "la-greca-fria": ["panela", "willys", "guadua"],
  "yo-no-dije-nada": ["mazamorra", "chócolo", "cabuya", "trapiche"],
  "la-casilla-en-blanco": ["tepual", "luma"],
  "quiltro-con-dueno": ["milcao"],
  "me-quedo-con-el-bote": ["pellín"],
  "antes-eran-mias": ["cayote"],
  "le-falta-sal": ["pipián", "carantanta"],
};

(async () => {
  let n = 0;
  for (const [slug, palabras] of Object.entries(FUERA)) {
    const h = await p.journeyStory.findFirst({
      where: { journeyId: JOURNEY, slug }, select: { text: true, title: true, vocab: true, audioUrl: true },
    });
    if (!h) { console.log(`SIN HISTORIA: ${slug}`); continue; }
    const texto = `${h.title}. ${h.text}`;
    const voc = (h.vocab as Array<{ word?: unknown; surface?: unknown }>) ?? [];
    const ocupadas = new Set(voc.flatMap((v) => [String(v?.word ?? ""), String(v?.surface ?? "")]).map((x) => x.toLowerCase()));
    console.log(`\n${h.audioUrl ? "NARRADA " : "        "}${slug}  (${palabras.length} plazas)`);
    for (const w of palabras) {
      const re = new RegExp(`(?<![\\p{L}\\p{M}])${w}[a-záéíóúñ]*(?![\\p{L}\\p{M}])`, "giu");
      const veces = (texto.match(re) ?? []).length;
      n++;
      console.log(`  ${veces === 1 ? "una vez " : `${veces} VECES`}  ${w}`);
    }
    const enCuerpo = [...new Set((`${h.text}`.toLowerCase().match(/\p{L}+/gu) ?? []))];
    const cand = enCuerpo.filter((w) => w.length > 4 && !ocupadas.has(w) && isSpanishUpToLevel(w, "b1"));
    console.log(`  candidatas: ${cand.join(", ")}`);
  }
  console.log(`\n${n} plazas comprobadas`);
  await p.$disconnect();
})();
