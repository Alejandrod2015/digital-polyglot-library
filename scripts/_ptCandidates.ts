// ¿Hay gente en la cola que quiera PORTUGUÉS y que ahora sí podamos servir?
// Sólo lee. No invita, no escribe, no manda correos.
//   npx tsx scripts/_ptCandidates.ts
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const TEST_ROW = /betatest|postmigration|example\.com/i;
const PT = /portug|português|portugues|\bpt\b|brasil|brazil/i;

async function main() {
  // 1. Qué hay publicado de verdad en portugués.
  const journeys = await p.journey.findMany({
    where: { language: { contains: "ortug", mode: "insensitive" } },
    select: { id: true, name: true, status: true, language: true, variant: true, levels: true, topics: true },
  });
  console.log("── Journeys en portugués (todos los estados, para ver el mapa) ──");
  for (const j of journeys) {
    const stories = await p.journeyStory.count({ where: { journeyId: j.id, status: "published" } });
    const conTexto = await p.journeyStory.count({ where: { journeyId: j.id, text: { not: null } } });
    console.log(
      `  [${j.status.padEnd(8)}] ${j.name} · ${j.variant} · niveles ${j.levels.join("/")} · temas ${j.topics.length} · historias publicadas: ${stories} / con texto: ${conTexto}`
    );
  }
  const live = journeys.filter((j) => j.status === "active");
  console.log(`  → publicados (active): ${live.length}\n`);

  // 2. Reglas: ¿acepta ya portugués el evaluador?
  const row = await p.studioConfig.findUnique({ where: { key: "beta_rules_v1" } });
  const rules = (row?.value ?? {}) as { acceptedTargetLanguages?: string[]; maxActiveTesters?: number };
  console.log("── Reglas del programa beta ──");
  console.log("  idiomas aceptados:", (rules.acceptedTargetLanguages ?? ["(por defecto)"]).join(", "));
  const acceptsPt = (rules.acceptedTargetLanguages ?? []).some((l) => PT.test(l));
  console.log("  ¿acepta portugués?:", acceptsPt ? "sí" : "NO; la cola PT sigue cayendo fuera");

  const active = await p.betaSignup.count({ where: { status: { in: ["invited", "accepted"] } } });
  console.log(`  activos ahora: ${active}${rules.maxActiveTesters ? ` · tope: ${rules.maxActiveTesters}` : ""}\n`);

  // 3. Quién pidió portugués y en qué estado quedó.
  const todos = (await p.betaSignup.findMany({ orderBy: { createdAt: "asc" } })).filter(
    (a) => !TEST_ROW.test(a.email)
  );
  const pt = todos.filter((a) => PT.test(a.targetLanguage ?? ""));
  console.log(`── Solicitudes que piden portugués: ${pt.length} de ${todos.length} ──`);
  for (const a of pt) {
    const dias = Math.round((Date.now() - a.createdAt.getTime()) / 86_400_000);
    console.log(
      `  ${a.status.padEnd(9)} ${(a.firstName ?? "(sin nombre)").padEnd(14)} ${(a.platform ?? "ios").padEnd(8)} hace ${String(dias).padStart(3)}d  ${a.email}`
    );
    if (a.reason) console.log(`            razón: ${a.reason.slice(0, 120)}`);
  }
  const enCola = pt.filter((a) => ["waitlist", "pending"].includes(a.status));
  console.log(`\n  → esperando todavía (waitlist/pending): ${enCola.length}`);

  // 4. ¿Está el journey PT en condiciones de aguantar a un tester?
  //    Texto no basta: sin audio la experiencia no es la del producto.
  for (const j of live) {
    const [conAudio, conCover, total] = await Promise.all([
      p.journeyStory.count({ where: { journeyId: j.id, audioUrl: { not: null } } }),
      p.journeyStory.count({ where: { journeyId: j.id, coverUrl: { not: null } } }),
      p.journeyStory.count({ where: { journeyId: j.id } }),
    ]);
    console.log(`\n── Estado real de "${j.name}" (${total} historias) ──`);
    console.log(`  con audio  : ${conAudio}/${total}`);
    console.log(`  con portada: ${conCover}/${total}`);
  }

}

main().finally(() => p.$disconnect());
