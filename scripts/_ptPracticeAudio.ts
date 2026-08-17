// ¿Tienen audio los ejercicios de práctica, y de qué tipo? Solo lee.
// Los clips viven en payload.audioClip.{clipUrl, wordClipUrl}, no en columnas.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

type Payload = { audioClip?: { clipUrl?: string | null; wordClipUrl?: string | null } | null };

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    select: { id: true, name: true, language: true, variant: true },
  });

  for (const j of journeys) {
    const ejs = await p.storyPracticeExercise.findMany({
      where: { set: { story: { journeyId: j.id } } },
      select: { type: true, payload: true, featured: true },
    });
    const porTipo = new Map<string, { total: number; palabra: number; frase: number }>();
    for (const e of ejs) {
      const ac = (e.payload as Payload | null)?.audioClip;
      const t = porTipo.get(e.type) ?? { total: 0, palabra: 0, frase: 0 };
      t.total++;
      if (ac?.wordClipUrl) t.palabra++;
      if (ac?.clipUrl) t.frase++;
      porTipo.set(e.type, t);
    }
    console.log(`\n${j.language}/${j.variant} · ${j.name}  (${ejs.length} ejercicios)`);
    for (const [tipo, t] of [...porTipo.entries()].sort()) {
      console.log(
        `   ${tipo.padEnd(20)} ${String(t.total).padStart(4)} · palabra ${String(t.palabra).padStart(4)}/${String(t.total).padStart(4)} · frase ${String(t.frase).padStart(4)}/${String(t.total).padStart(4)}`
      );
    }
  }
}
main().finally(() => p.$disconnect());
