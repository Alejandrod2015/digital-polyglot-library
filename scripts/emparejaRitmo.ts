/**
 * EMPAREJA EL RITMO de una historia narrada, parrafo a parrafo, SIN gastar
 * creditos: estira el audio que ya existe.
 *
 *   npx tsx scripts/emparejaRitmo.ts <slug>            mide y dice que haria
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/emparejaRitmo.ts <slug> --apply
 *
 * POR QUE (2026-09-08). Cada oracion se sintetiza por separado y ElevenLabs le
 * da su propio ritmo. El usuario oyo "Afuera pasa una chiva llena de cajas" a
 * 3,45 palabras/s en una historia cuya mediana era 2,31 y pregunto por que iba
 * tan rapida. Con la voz no se puede garantizar: el motor decide el ritmo en
 * cada toma y no lo dice antes de cobrarla. Con el audio YA RENDERIZADO si,
 * porque estirar es determinista: `atempo` alarga sin tocar el tono.
 *
 * QUE HACE: mide palabras/segundo por parrafo, toma la MEDIANA de la historia
 * como objetivo, y estira los parrafos que van por encima hasta dejarlos en la
 * banda. Reutiliza el empalme por secciones que ya existe (cada parrafo vive
 * como su propia seccion), asi que el corte cae donde ya caia y el master se
 * reconstruye con la maquinaria de siempre. Despues re-alinea el karaoke.
 *
 * TOPE DEL 15% (`MAX_ESTIRADO`), y es conservador a proposito: estirar mucho
 * suena metalico, y donde empieza a oirse no lo hemos medido nosotros; hoy
 * comprobamos de oido que 0,80 y 0,85 pasan desapercibidos. Lo que pida mas
 * del 15% NO se estira: se lista para re-tirarlo con _rerollSection, que
 * cuesta una oracion. Cuando midamos el punto real, se sube el tope aqui.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { execFile } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { PrismaClient } from "../src/generated/prisma";

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

/** Mas alla de esto no se estira: se re-tira. */
export const MAX_ESTIRADO = 0.15;

const palabras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

(async () => {
  const slug = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!slug) throw new Error("uso: emparejaRitmo.ts <slug> [--apply]");

  const s = await prisma.journeyStory.findFirst({
    where: { slug }, select: { id: true, slug: true, audioUrl: true, audioFragments: true },
  });
  if (!s?.audioUrl) throw new Error(`${slug} no tiene audio`);
  const frags = ((s.audioFragments as any[]) ?? []).filter((f) => f && f.url);
  if (frags.length < 3) throw new Error(`${slug} no tiene secciones por parrafo (${frags.length})`);

  const filas = frags.map((f, i) => {
    const dur = (f.endSec ?? 0) - (f.startSec ?? 0);
    const w = palabras(String(f.text ?? ""));
    return { i, w, dur, ws: dur > 0 ? w / dur : 0, url: String(f.url), texto: String(f.text ?? "") };
  });
  const orden = filas.map((f) => f.ws).filter((x) => x > 0).sort((a, b) => a - b);
  const objetivo = orden[Math.floor(orden.length / 2)];

  const tocar = filas
    .filter((f) => f.ws > objetivo && f.w >= 8)
    .map((f) => ({ ...f, factor: objetivo / f.ws }))
    .filter((f) => f.factor < 0.98);

  console.log(`${slug}: objetivo ${objetivo.toFixed(2)} w/s (mediana de ${filas.length} parrafos)`);
  const estirables = tocar.filter((f) => 1 - f.factor <= MAX_ESTIRADO);
  const duros = tocar.filter((f) => 1 - f.factor > MAX_ESTIRADO);
  for (const f of tocar) {
    const pct = Math.round((1 - f.factor) * 100);
    console.log(
      `  [${f.i}] ${f.ws.toFixed(2)} w/s → estirar ${pct}%` +
      (1 - f.factor > MAX_ESTIRADO ? "  (PASA DEL TOPE: re-tirar)" : "") +
      ` · ${f.texto.slice(0, 52)}`
    );
  }
  if (!tocar.length) console.log("  nada que emparejar");
  if (duros.length) {
    console.log(`\n  ${duros.length} parrafo(s) piden mas del ${Math.round(MAX_ESTIRADO * 100)}%; para esos:`);
    for (const f of duros)
      console.log(`    DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_rerollSection.ts ${slug} ${f.i} --tempo ${f.factor.toFixed(2)} --apply`);
  }
  if (!apply || !estirables.length) {
    if (!apply && estirables.length) console.log("\n--apply para empalmarlos (no gasta creditos).");
    await prisma.$disconnect();
    return;
  }

  const { replaceSectionAndRebuild } = await import("../src/lib/audioEditorSections");
  const dir = mkdtempSync(path.join(tmpdir(), "ritmo-"));
  for (const f of estirables) {
    const src = path.join(dir, `s${f.i}.mp3`);
    const out = path.join(dir, `s${f.i}_lento.mp3`);
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`no puedo bajar la seccion ${f.i}`);
    writeFileSync(src, Buffer.from(await res.arrayBuffer()));
    await execFileAsync("ffmpeg", ["-y", "-i", src, "-filter:a", `atempo=${f.factor.toFixed(3)}`, "-c:a", "libmp3lame", "-q:a", "2", out]);
    await replaceSectionAndRebuild({
      storyId: s.id, fragmentIndex: f.i, newSectionBuffer: readFileSync(out), normalizeSection: false,
    });
    console.log(`  [${f.i}] empalmado a ${f.factor.toFixed(3)}`);
  }

  const { generateWordTimingsForStory } = await import("../src/lib/audioWordTimings");
  await generateWordTimingsForStory(s.id);
  console.log("re-alineado; el karaoke describe el master nuevo");
  await prisma.$disconnect();
})();
