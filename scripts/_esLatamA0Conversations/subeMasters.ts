/**
 * Sube a R2 los 21 masters ya montados del Conversations ES latam A0 y deja el
 * mapa slug -> url en `audio-r2.json`, dentro de la rama.
 *
 * NO sintetiza nada: coge los `*-final.mp3` que ya existen en
 * public/_gato-muestra (gitignored) y los pone donde el proyecto guarda la
 * narracion, `media/generated/audio/`. El mapa existe para que, cuando las
 * filas de `JourneyStory` tengan su sitio, se enganchen sin volver a subir.
 *
 *   npx tsx scripts/_esLatamA0Conversations/subeMasters.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "fs";
import path from "path";
import { uploadAudioObject } from "../../src/lib/objectStorage";
import { PrismaClient } from "../../src/generated/prisma";

const AUD = "/Users/alejandrodelcarpio/digital-polyglot-library/public/_gato-muestra";
const DIR = "scripts/_esLatamA0Conversations";
const TEMAS = ["new-neighbors", "home-and-neighbors", "clothes-and-laundry",
  "packages-and-deliveries", "noise-and-sleep", "wifi-and-passwords", "goodbyes-and-keys"];

/** Mismo molde que el resto del catalogo: Titulo_sin_acentos_multivoice_<ms>.mp3 */
const nombre = (titulo: string) =>
  `${titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}_multivoice_${Date.now()}.mp3`;

const master = (topic: string, slot: number) => {
  const t = TEMAS.indexOf(topic) + 1;
  return t === 1
    ? `${AUD}/historia${slot + 1}/historia${slot + 1}-final.mp3`
    : `${AUD}/t${t}-historia${slot + 1}/t${t}-historia${slot + 1}-final.mp3`;
};

(async () => {
  const dry = process.argv.includes("--dry");
  const prisma = new PrismaClient();
  // El slug real lo pone `saveStory` al guardar; para el tema 7, que todavia
  // no esta en la base, se deriva del titulo igual que alli.
  const filas = await prisma.journeyStory.findMany({
    where: { journeyId: "cmub5my8d000432ye0v6pv5ng" },
    select: { topic: true, slotIndex: true, slug: true },
  });
  await prisma.$disconnect();
  const slugDe = (topic: string, slot: number, titulo: string) =>
    filas.find((f) => f.topic === topic && f.slotIndex === slot)?.slug
    ?? titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
         .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const stories = JSON.parse(fs.readFileSync(`${DIR}/las21.json`, "utf8")) as Array<{
    topic: string; slotIndex: number; title: string; slug?: string; text: string;
  }>;
  const salida = `${DIR}/audio-r2.json`;
  const mapa: Record<string, unknown> = fs.existsSync(salida)
    ? JSON.parse(fs.readFileSync(salida, "utf8")) : {};

  let subidos = 0, bytes = 0;
  for (const s of stories) {
    const f = master(s.topic, s.slotIndex);
    if (!fs.existsSync(f)) { console.error(`FALTA el master de ${s.topic}#${s.slotIndex}: ${f}`); process.exit(1); }
    const body = fs.readFileSync(f);
    const slug = slugDe(s.topic, s.slotIndex, s.title);
    const filename = nombre(s.title);
    const key = `media/generated/audio/${filename}`;
    bytes += body.length;
    if (dry) { console.log(`[--dry] ${slug} · ${(body.length / 1e6).toFixed(1)} MB -> ${key}`); continue; }
    const r = await uploadAudioObject({ key, body, contentType: "audio/mpeg" });
    if (!r) { console.error(`sin almacenamiento configurado, paro en ${slug}`); process.exit(1); }
    mapa[slug] = {
      topic: s.topic, slotIndex: s.slotIndex, title: s.title,
      audioFilename: filename, audioUrl: r.url, key: r.key,
      bytes: body.length, origen: path.relative(AUD, f), subido: new Date().toISOString(),
    };
    subidos++;
    console.log(`OK ${slug} · ${(body.length / 1e6).toFixed(1)} MB · ${r.url}`);
  }
  if (!dry) {
    fs.writeFileSync(salida, JSON.stringify(mapa, null, 2) + "\n");
    console.log(`\n${subidos} masters · ${(bytes / 1e6).toFixed(1)} MB · mapa en ${salida}`);
  } else {
    console.log(`\n[--dry] ${stories.length} masters · ${(bytes / 1e6).toFixed(1)} MB, nada subido`);
  }
})().catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); });
