/**
 * RIQUEZA DE LA PROSA: que porcentaje de las palabras distintas de un journey
 * esta por encima de A1/A2.
 *
 *   npx tsx scripts/riquezaProsa.ts <journeyId|todos>
 *
 * POR QUE (2026-09-08). El suelo de nivel mide las PLAZAS; este mide el TEXTO,
 * que es de donde salen las plazas. El 2026-09-08 se descubrio que no se podia
 * subir el nivel del vocab de tres journeys porque su prosa no tenia palabras
 * de nivel: la plaza solo puede apuntar a lo que esta escrito. Medido entonces:
 *
 *   Friends latam C1 (publicado)   47%      Traveler latam B2   39%
 *   Friends colombia C1 (publicado) 44%     Traveler latam B1   33%
 *   Friends mexico C1 (draft)      43%      Traveler spain B2   30%
 *   Friends argentina C1 (draft)   45%      Traveler spain B1   28%
 *
 * Se corre AL PLANIFICAR un journey nuevo y despues del primer tema, cuando
 * cambiar el registro de la prosa todavia es barato. Despues de 21 historias
 * escritas ya no lo es, y con audio pagado, menos: por eso no es un gate del
 * pre-push sino un paso del plan. Referencia para uno nuevo de B1 o mas: 40%.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";
import { extractStoryPlainText } from "../src/lib/storyPlainText";

const prisma = new PrismaClient();
const REFERENCIA = 0.40;

(async () => {
  const arg = process.argv[2];
  const where = arg && arg !== "todos"
    ? { id: arg }
    : { language: "spanish", status: { not: "archived" as const } };
  const js = await prisma.journey.findMany({
    where, select: { id: true, name: true, variant: true, levels: true, status: true, language: true },
  });
  for (const j of js) {
    if (j.language !== "spanish") {
      console.log(`(${j.name} ${j.variant}: solo hay lista graduada en espanol)`);
      continue;
    }
    const nivel = (j.levels[0] ?? "").toLowerCase();
    const st = await prisma.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true } });
    const set = new Set<string>();
    for (const s of st)
      for (const m of extractStoryPlainText(String(s.text ?? "")).toLowerCase().matchAll(/\p{L}{3,}/gu))
        set.add(m[0]);
    if (!set.size) continue;
    const arr = [...set];
    const sobre = arr.filter((w) => !isSpanishUpToLevel(w, "a2"));
    const pct = sobre.length / arr.length;
    const juzga = ["b1", "b2", "c1", "c2"].includes(nivel);
    const marca = !juzga ? "    " : pct >= REFERENCIA ? "ok  " : "FLOJA";
    console.log(
      `${marca} ${(j.name + " " + j.variant + " " + nivel).padEnd(28)} ${Math.round(pct * 100)}%` +
      ` de ${arr.length} palabras distintas por encima de A1/A2` +
      (juzga && pct < REFERENCIA ? ` · referencia ${Math.round(REFERENCIA * 100)}%: la prosa no da para ensenar plazas de su nivel` : "")
    );
  }
  await prisma.$disconnect();
})();
