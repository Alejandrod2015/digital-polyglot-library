/**
 * RITMO POR ORACION dentro de una historia narrada.
 *
 *   npx tsx scripts/checkNarrationPace.ts <slug>      una historia
 *   npx tsx scripts/checkNarrationPace.ts --todas     barrido del catalogo
 *
 * POR QUE (2026-09-08). El usuario oyo "Afuera pasa una chiva llena de cajas"
 * y pregunto por que iba tan rapida: 3,45 palabras/s en una historia cuya
 * mediana era 2,31. Cada oracion se sintetiza por separado y ElevenLabs le da
 * su propio ritmo; nadie los emparejaba despues. `normalizeAudioPace` empareja
 * historias ENTERAS entre si, que es otra cosa: dentro de una historia el
 * desnivel seguia invisible.
 *
 * QUE MIDE: palabras/segundo por oracion (audioSegments), solo en oraciones de
 * 8 palabras o mas; por debajo, el ritmo es ruido (una acotacion de cuatro
 * palabras da 3 w/s y suena normal). Marca la oracion que cumple LAS DOS:
 * pasa de 3,2 w/s absolutos Y de 1,35 veces la mediana de su historia. La
 * primera condicion es lo que se oye rapido; la segunda, que desentona con el
 * resto de ESA historia, que es lo que el oido nota.
 *
 * NO ES UN GATE, y por que: medido el 2026-09-08 sobre las 336 historias
 * publicadas con audio, el 20% de las oraciones largas ya pasan de 3 w/s y
 * entre el 26% y el 55% de las historias tienen al menos una marcada, segun
 * el umbral. Bloquear eso hoy pararia el catalogo entero por deuda vieja. Se
 * corre al narrar (lo llama _narraUnaA2 despues de alinear) para cazarlo
 * cuando arreglarlo cuesta una oracion: _rerollSection <slug> <frag> --tempo T.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const ABS = 3.2;
const MULT = 1.35;
const MIN_PALABRAS = 8;

export type Rapida = { texto: string; ws: number; mediana: number; fragmento: number | null };

/** Las oraciones que van notablemente mas rapidas que su propia historia. */
export function rapidasDe(
  segmentos: Array<{ text: string; startSec: number; endSec: number }>,
  fragmentos?: Array<{ startSec?: number; endSec?: number }>,
): Rapida[] {
  const utiles = segmentos.filter((g) => g && g.endSec > g.startSec);
  if (utiles.length < 4) return [];
  const ws = (g: { text: string; startSec: number; endSec: number }) =>
    g.text.trim().split(/\s+/).length / (g.endSec - g.startSec);
  const orden = utiles.map(ws).sort((a, b) => a - b);
  const mediana = orden[Math.floor(orden.length / 2)];
  const out: Rapida[] = [];
  for (const g of utiles) {
    if (g.text.trim().split(/\s+/).length < MIN_PALABRAS) continue;
    const r = ws(g);
    if (r <= ABS || r <= mediana * MULT) continue;
    // El fragmento (parrafo) que la contiene, que es la unidad que se re-tira.
    const i = (fragmentos ?? []).findIndex(
      (f) => (f.startSec ?? 0) <= g.startSec + 0.05 && (f.endSec ?? 0) >= g.endSec - 0.05,
    );
    out.push({ texto: g.text.trim(), ws: r, mediana, fragmento: i >= 0 ? i : null });
  }
  return out;
}

/** Lo que imprime el runner de narracion despues de alinear. */
export function informe(slug: string, rapidas: Rapida[]): string {
  if (!rapidas.length) return `ritmo: sin oraciones aceleradas`;
  return [
    `ritmo: ${rapidas.length} oracion(es) por encima de ${ABS} w/s y ${MULT}x la mediana`,
    ...rapidas.map((r) =>
      `   ${r.ws.toFixed(2)} w/s (mediana ${r.mediana.toFixed(2)}) · ${r.texto.slice(0, 60)}` +
      (r.fragmento !== null
        ? `\n     arreglo: DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_rerollSection.ts ${slug} ${r.fragmento} --tempo ${(r.mediana / r.ws).toFixed(2)} --apply`
        : "")),
  ].join("\n");
}

if (require.main === module) {
  (async () => {
    const arg = process.argv[2];
    const where = arg && arg !== "--todas" ? { slug: arg } : { audioUrl: { not: null } };
    const st = await prisma.journeyStory.findMany({
      where, select: { slug: true, audioSegments: true, audioFragments: true },
    });
    let conRapidas = 0;
    for (const s of st) {
      const r = rapidasDe((s.audioSegments as any) ?? [], (s.audioFragments as any) ?? []);
      if (!r.length) continue;
      conRapidas++;
      console.log(`\n${s.slug}`);
      console.log(informe(s.slug ?? "", r));
    }
    console.log(`\n${conRapidas}/${st.length} historias con alguna oracion acelerada.`);
    await prisma.$disconnect();
  })();
}
