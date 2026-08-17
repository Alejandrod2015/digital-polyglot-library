/**
 * Lista los fragmentos cuyo mp3 NO dice lo que dice el texto, y rellena
 * `renderedText` en los másters antiguos que no lo tienen.
 *
 * WHY (2026-08-17): `audioFragments[i].text` hacía dos trabajos a la vez, ser
 * la entrada del re-tiro y ser el registro de lo grabado. `saveStory` lo
 * sincroniza con el cuerpo al guardar (si no, un re-tiro narraría la frase
 * vieja), y al hacerlo borraba el único testigo del audio. La comparación
 * "fragmento contra texto" no podía fallar nunca: dio "0 desfasados" en tres
 * historias cuyos mp3 decían otra cosa. Ahora `renderedText` guarda lo que el
 * mp3 dice y solo lo escriben el render y el empalme.
 *
 *   npx tsx scripts/_audioDrift.ts <journeyId>            # informe
 *   npx tsx scripts/_audioDrift.ts <journeyId> --backfill # sella los antiguos
 *
 * El backfill solo rellena `renderedText` donde falta, copiando el `text`
 * actual. Eso da por bueno el audio existente, así que se corre UNA vez sobre
 * másters que se sabe al día; para los que no lo están, se re-tira antes.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
type Frag = { index: number; text?: string; renderedText?: string };
const norm = (s: string) => s.trim().replace(/[“”«»"]/g, "").replace(/\s+/g, " ").replace(/[.]+$/, "");

void (async () => {
  const journeyId = process.argv[2];
  const backfill = process.argv.includes("--backfill");
  // El sellado da por bueno el audio existente, así que se limita a las
  // historias que se sabe al día. Sin este filtro se sellarían también las que
  // están desfasadas, que es justo la mentira que este campo viene a evitar.
  const i = process.argv.indexOf("--slug");
  const soloSlug = i >= 0 ? process.argv[i + 1] : null;
  if (!journeyId) { console.error("uso: _audioDrift.ts <journeyId> [--backfill]"); process.exit(1); }

  const rows = await prisma.journeyStory.findMany({
    where: { journeyId, audioUrl: { not: null }, ...(soloSlug ? { slug: soloSlug } : {}) },
    select: { id: true, slug: true, audioFragments: true },
  });

  let sinSello = 0, desfasados = 0;
  for (const r of rows) {
    const frags = (r.audioFragments as Frag[] | null) ?? [];
    if (!frags.length) continue;
    const falta = frags.filter((f) => typeof f.renderedText !== "string");
    const mal = frags.filter((f) => typeof f.renderedText === "string" && norm(f.renderedText) !== norm(f.text ?? ""));

    if (mal.length) {
      desfasados += mal.length;
      console.log(`${r.slug}: ${mal.length} fragmento(s) DESFASADOS -> ${mal.map((f) => f.index).join(", ")}`);
      for (const f of mal) {
        console.log(`   [${f.index}] mp3 dice: ${norm(f.renderedText!).slice(0, 70)}`);
        console.log(`        texto dice: ${norm(f.text ?? "").slice(0, 70)}`);
      }
    }
    if (falta.length) {
      sinSello += falta.length;
      if (backfill) {
        const nuevos = frags.map((f) => (typeof f.renderedText === "string" ? f : { ...f, renderedText: f.text ?? "" }));
        await prisma.journeyStory.update({ where: { id: r.id }, data: { audioFragments: nuevos as never } });
        console.log(`${r.slug}: ${falta.length} fragmento(s) sellados con el texto actual`);
      } else {
        console.log(`${r.slug}: ${falta.length} fragmento(s) sin sellar (corre --backfill si su audio está al día)`);
      }
    }
  }

  console.log(`\n${rows.length} historias con audio · ${desfasados} fragmentos desfasados · ${sinSello} sin sellar`);
  await prisma.$disconnect();
})();
