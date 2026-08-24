/** Retira la muestra de narracion de una historia del A1 latam.
 *
 *  La muestra se colgo de la fila con `--en-la-historia` para poder oirla en el
 *  lector. Cuando el TEXTO de la historia cambia, ese mp3 deja de corresponder
 *  al cuerpo y hay que quitarlo ANTES del render completo: si no, la tabla dice
 *  que hay audio y el lector sirve una narracion que ya no es la historia.
 *
 *  No borra nada de R2: el mp3 sigue ahi y la cache de segmentos tambien, asi
 *  que volver a colgarlo no cuesta creditos. Solo limpia la fila.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmt5vxwgd0007324oesy195k8";
(async () => {
  const slug = process.argv[2];
  if (!slug) { console.error("uso: _a1latamClearAudio.ts <slug>"); process.exit(1); }
  const p = new PrismaClient();
  const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true, audioUrl: true, audioFilename: true } });
  if (!s) { console.error(`no hay historia ${slug} en este journey`); process.exit(1); }
  // No basta con mirar `audioUrl`: la primera version salia por aqui dejando
  // los `audioFragments` y el `audioFilename` puestos, y la fila seguia
  // contando como "tiene audio" en la tabla por temas.
  if (!s.audioUrl && !s.audioFilename) { console.log(`${slug}: ya no tenia audio`); await p.$disconnect(); return; }
  console.log(`retirando ${s.audioFilename ?? s.audioUrl}`);
  await p.journeyStory.update({ where: { id: s.id },
    data: { audioUrl: null, audioStatus: "none" } });
  // `audioFragments` es JSON y no admite null por el cliente; va por SQL.
  await p.$executeRawUnsafe(`UPDATE "dp_journey_stories_v1" SET "audioFragments" = NULL, "audioFilename" = NULL WHERE id = $1`, s.id);
  const q = await p.journeyStory.findUnique({ where: { id: s.id }, select: { audioUrl: true, audioFragments: true } });
  console.log(`${slug}: audioUrl=${q?.audioUrl ?? "null"} · fragments=${q?.audioFragments === null ? "null" : "?"}`);
  await p.$disconnect();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
