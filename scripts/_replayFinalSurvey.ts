// Replay del envío del 2026-08-23 con el libro mayor VACÍO, para comparar el
// portón viejo (sólo calendario) con el nuevo (uso + antigüedad). No envía nada.
import Module from "node:module";
const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, ...a: unknown[]) {
  if (r === "server-only") return {};
  return load.call(this, r, ...a);
};
import { config } from "dotenv";
config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env.local", quiet: true });

const ENGAGEMENT = ["story_opened","vocab_clicked","audio_play","audio_complete","practice_session_started","practice_session_completed"];

(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { decideBetaEmail } = await import("../src/lib/betaLifecycle");
  const { DEFAULT_BETA_RULES } = await import("../src/lib/betaRules");
  const p = new PrismaClient();

  const cfg = await p.studioConfig.findUnique({ where: { key: "beta_rules_v1" } });
  const rules = { ...DEFAULT_BETA_RULES, ...((cfg?.value as object) ?? {}) };
  const now = new Date(process.argv[2] ?? "2026-08-23T11:01:00.000Z");

  const testers = await p.betaSignup.findMany({
    where: { status: { in: ["invited", "accepted"] }, planRevokedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const ids = testers.map((t) => t.clerkUserId).filter(Boolean) as string[];
  const grouped = await p.userMetric.groupBy({
    by: ["userId"],
    where: { userId: { in: ids }, eventType: { in: ENGAGEMENT } },
    _count: { _all: true },
  });
  const finished = new Map(grouped.map((g) => [g.userId, g._count._all]));

  // Quién recibió de verdad el final_survey ese día.
  const real = new Set(
    (await p.betaEmailLog.findMany({ where: { kind: "final_survey" }, select: { signupId: true } }))
      .map((r) => r.signupId),
  );

  console.log(`suelo de antigüedad: ${rules.finalSurveyMinTenureDays} d\n`);
  let recibieron = 0;
  let siguen = 0;
  for (const t of testers) {
    const n = t.clerkUserId ? (finished.get(t.clerkUserId) ?? 0) : 0;
    const d = decideBetaEmail({
      tester: t as never,
      now,
      rules,
      finalRating: null,
      engagementEvents: n,
      alreadySent: new Set(),
    });
    if (!real.has(t.id)) continue;
    recibieron++;
    const start = t.planGrantedAt ?? t.invitedAt;
    const dias = start ? (now.getTime() - start.getTime()) / 86400000 : NaN;
    const ahora = d?.kind === "final_survey";
    if (ahora) siguen++;
    console.log(
      `  ${(t.firstName ?? "?").padEnd(16)} ${dias.toFixed(1).padStart(5)} d  eventos:${String(n).padStart(3)}  →  ${ahora ? "final_survey" : `CORTADO (${d?.kind ?? "nada"})`}`,
    );
  }
  console.log(`\n  lo recibieron: ${recibieron}   con el portón nuevo: ${siguen}   cortados: ${recibieron - siguen}`);
  await p.$disconnect();
})();
