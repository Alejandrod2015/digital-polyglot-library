/**
 * Reasigna la voz del personaje Lea (Expat DE, "Umzug ohne Aufzug") de Daien a
 * Rebecca Green, aprobada por el usuario el 2026-07-29 tras oír un sample con
 * las líneas reales del personaje.
 *
 * SOLO toca `dialogueSpec` (los 2 segmentos de Lea). No escribe texto ni vocab,
 * no re-renderiza audio y no cambia `audioStatus`: el mp3 publicado sigue
 * siendo el de Daien hasta que se lance el render explícitamente.
 *
 * Usage: tsx scripts/_setLeaVoice.ts --dry-run | --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertVoiceApproved } from "../src/lib/approvedVoices";

const SLUG = "umzug-ohne-aufzug";
const OLD = "9iYBWBbTzTDIt6imiMxp"; // Daien
const NEW = "oNs4CSS4LR7hEoEykuS5"; // Rebecca Green - Calm and Articulate

(async () => {
  const apply = process.argv.includes("--apply");
  if (!apply && !process.argv.includes("--dry-run")) {
    console.error("pass --dry-run or --apply");
    process.exit(1);
  }
  assertVoiceApproved(NEW, "lea:umzug-ohne-aufzug");

  const prisma = new PrismaClient();
  const row = (await prisma.journeyStory.findFirst({
    where: { slug: SLUG },
    select: { id: true, title: true, audioStatus: true, dialogueSpec: true },
  })) as any;
  if (!row) throw new Error(`no existe la historia ${SLUG}`);

  const spec = Array.isArray(row.dialogueSpec) ? row.dialogueSpec : [];
  let touched = 0;
  const next = spec.map((s: any) => {
    if (String(s.speaker || "").toLowerCase() !== "lea") return s;
    if (s.voice !== OLD) {
      console.log(`  ! segmento de Lea con voz inesperada (${s.voice}), lo dejo`);
      return s;
    }
    touched++;
    return { ...s, voice: NEW };
  });

  console.log(`${row.title} (audio=${row.audioStatus}) | ${touched} segmentos de Lea -> Rebecca Green`);
  if (touched === 0) throw new Error("no encontré segmentos de Lea con la voz vieja");

  if (apply) {
    await prisma.journeyStory.update({ where: { id: row.id }, data: { dialogueSpec: next as any } });
    console.log("aplicado");
  } else {
    console.log("[dry] sin escribir");
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
