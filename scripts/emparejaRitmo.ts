/**
 * MIDE EL RITMO parrafo a parrafo de una historia narrada y dice que parrafos
 * desentonan con la propia historia.
 *
 *   npx tsx scripts/emparejaRitmo.ts <slug>
 *
 * POR QUE (2026-09-08). Cada oracion se sintetiza por separado y ElevenLabs le
 * da su propio ritmo. El usuario oyo "Afuera pasa una chiva llena de cajas" a
 * 3,45 palabras/s en una historia cuya mediana era 2,31 y pregunto por que iba
 * tan rapida. `normalizeAudioPace` empareja historias ENTERAS entre si, asi que
 * el desnivel DENTRO de una historia no lo miraba nadie.
 *
 * ESTIRAR EL AUDIO YA RENDERIZADO NO VALE, y aqui esta la prueba. Este script
 * lo hizo durante una tarde: `atempo` alarga sin tocar el tono, es determinista
 * y no gasta creditos, asi que parecia la respuesta. Se aplico a las tres
 * historias del primer tema del B1 latam con un tope del 15% que declare
 * conservador "porque 0,80 y 0,85 pasan desapercibidos". Eso no lo habia
 * comprobado nadie: era una suposicion mia escrita como si fuera una medida.
 * El usuario senalo de oido una sola frase, "Te lo saldo con dos jornadas
 * mias", que es justo la que se habia estirado un 14%. Las nueve secciones
 * estiradas de las tres historias volvieron a su toma original.
 *
 * Encima el empalme re-codificaba con `-q:a 2`, que en MONO son ~117 kbps
 * frente a los 197 que entrega ElevenLabs: perdida de generacion sumada al
 * estirado. Dos defectos en el mismo paso.
 *
 * QUE QUEDA: medir, que es lo que si sirve, y arreglar RE-SINTETIZANDO la
 * seccion con `_rerollSection --tempo`, que cuesta una oracion y sale con el
 * ritmo pedido de fabrica en vez de deformar una toma buena. El comando sale
 * ya calculado abajo. La regla general: el ritmo se arregla en la sintesis,
 * nunca estirando el master.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const palabras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

(async () => {
  const slug = process.argv[2];
  if (!slug) throw new Error("uso: emparejaRitmo.ts <slug>");

  const s = await prisma.journeyStory.findFirst({
    where: { slug }, select: { id: true, slug: true, audioUrl: true, audioFragments: true },
  });
  if (!s?.audioUrl) throw new Error(`${slug} no tiene audio`);
  const frags = ((s.audioFragments as any[]) ?? []).filter((f) => f && f.url);
  if (frags.length < 3) throw new Error(`${slug} no tiene secciones por parrafo (${frags.length})`);

  const filas = frags.map((f, i) => {
    const dur = (f.endSec ?? 0) - (f.startSec ?? 0);
    const w = palabras(String(f.text ?? ""));
    return { i, w, dur, ws: dur > 0 ? w / dur : 0, texto: String(f.text ?? "") };
  });
  const orden = filas.map((f) => f.ws).filter((x) => x > 0).sort((a, b) => a - b);
  const objetivo = orden[Math.floor(orden.length / 2)];

  const tocar = filas
    .filter((f) => f.ws > objetivo && f.w >= 8)
    .map((f) => ({ ...f, factor: objetivo / f.ws }))
    .filter((f) => f.factor < 0.9);

  console.log(`${slug}: objetivo ${objetivo.toFixed(2)} w/s (mediana de ${filas.length} parrafos)`);
  if (!tocar.length) console.log("  ningun parrafo desentona");
  for (const f of tocar) {
    console.log(`  [${f.i}] ${f.ws.toFixed(2)} w/s · ${f.texto.slice(0, 52)}`);
    const speed = Math.min(1.2, Math.max(0.7, 0.9 * f.factor)).toFixed(2);
    console.log(`     DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_rerollSection.ts ${slug} ${f.i} --tempo 1.0 --speed ${speed} --apply`);
  }
  await prisma.$disconnect();
})();
