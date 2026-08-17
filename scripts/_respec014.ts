/**
 * Reconstruye el dialogueSpec de las 21 historias del journey 014 a partir del
 * cuerpo ACTUAL y del reparto aprobado por el usuario el 2026-07-31.
 *
 * NO toca `text` ni `vocab` de la historia (eso solo entra por saveStory.ts).
 * El unico campo escrito es `dialogueSpec`, que es metadato de casting de audio.
 *
 *   npx tsx scripts/_respec014.ts          -> simula
 *   npx tsx scripts/_respec014.ts --apply  -> escribe
 */
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { isVoiceApproved } from "../src/lib/approvedVoices";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const NARR = "2EWay75ikIPKrY4w2j69";
const VOICE: Record<string, string> = {
  narrator: NARR,
  rosario: "6GR02MFuGHk4fa0vsd4K",
  vicente: "Ypjv4S8CWJLMvXfBMUtN", vecino: "Ypjv4S8CWJLMvXfBMUtN",
  marta: "GB7fZx4ubHWxbBE05abF", sabela: "GB7fZx4ubHWxbBE05abF", clara: "GB7fZx4ubHWxbBE05abF",
  "rocío": "Sp57wugtIMQc3lhms94f", "lucía": "Sp57wugtIMQc3lhms94f",
  sergio: "eZCjPaC4W7mcOOERqE5n", "álvaro": "eZCjPaC4W7mcOOERqE5n",
  david: "eZCjPaC4W7mcOOERqE5n", sobrino: "eZCjPaC4W7mcOOERqE5n",
  curro: "j41pQugxGaKleSQLIyG2", hugo: "j41pQugxGaKleSQLIyG2",
  brais: "j41pQugxGaKleSQLIyG2", marc: "j41pQugxGaKleSQLIyG2",
  "andrés": "gQLV6zBnMa9rDESaeDz9",
  pilar: "py37pY8QUQdhW5a7JwPG", "tía": "py37pY8QUQdhW5a7JwPG", vecina: "py37pY8QUQdhW5a7JwPG",
  elena: "dX2UjlDzOz7RY8kmMXZo", nuria: "dX2UjlDzOz7RY8kmMXZo",
  paco: "xx2kHcDBInz34YT5TKkB",
  reme: "ERYLdjEaddaiN9sDjaMX",
  "carmiña": "PksrhvpHrGUgesnsmLTX",
  "begoña": "FM3ChNOHGKKULNhmx5m2",
};

const JOURNEY = "cmqc6tojm000032el2ebwsgkn";

async function main() {
  const prisma = new PrismaClient();
  const apply = process.argv.includes("--apply");
  const rows = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { id: true, title: true, body: false as never, text: true },
  });
  const unknown = new Set<string>();
  let totalSegs = 0, blocked = 0;

  for (const row of rows) {
    const segments: Array<Record<string, string>> = [];
    for (const line of String(row.text).split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü]*):\s+(.*)$/);
      if (m) {
        const key = m[1].toLowerCase();
        if (!VOICE[key]) unknown.add(m[1]);
        segments.push({ speaker: m[1], voice: VOICE[key] ?? NARR, text: m[2] });
      } else {
        segments.push({ speaker: "narrator", voice: NARR, text: trimmed });
      }
    }
    totalSegs += segments.length;
    const bad = segments.filter((s) => !isVoiceApproved(s.voice));
    if (bad.length) {
      blocked++;
      console.log(`!! ${row.title}: ${bad.length} segmentos con voz NO aprobada`);
      continue;
    }
    if (apply) {
      await prisma.journeyStory.update({ where: { id: row.id }, data: { dialogueSpec: segments } });
    }
    const speakers = new Set(segments.map((s) => s.speaker));
    console.log(
      `${apply ? "escrito " : "simulado"} ${String(row.title).slice(0, 30).padEnd(32)} ` +
      `${String(segments.length).padStart(2)} segmentos  ${speakers.size} hablantes`,
    );
  }

  console.log(`\nhistorias: ${rows.length} | segmentos: ${totalSegs} | bloqueadas: ${blocked}`);
  if (unknown.size) console.log("HABLANTES SIN VOZ ASIGNADA:", [...unknown].join(", "));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
