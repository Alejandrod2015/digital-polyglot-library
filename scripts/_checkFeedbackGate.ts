// Simula el cron de beta contra los testers reales, sin enviar nada, para ver
// a quién le tocaría cada correo hoy y dentro de N días.
//   npx tsx scripts/_checkFeedbackGate.ts [diasEnElFuturo]
import Module from "node:module";
const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, ...a: unknown[]) {
  if (r === "server-only") return {};
  return load.call(this, r, ...a);
};
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const AHEAD = Number(process.argv[2] ?? 0);

(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { decideBetaEmail } = await import("../src/lib/betaLifecycle");
  const { DEFAULT_BETA_RULES } = await import("../src/lib/betaRules");
  const p = new PrismaClient();

  const cfg = await p.studioConfig.findUnique({ where: { key: "beta_rules_v1" } });
  const rules = { ...DEFAULT_BETA_RULES, ...((cfg?.value as object) ?? {}) };
  const now = new Date(Date.now() + AHEAD * 86400000);

  const testers = await p.betaSignup.findMany({
    where: { status: { in: ["invited", "accepted"] }, planRevokedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const ids = testers.map((t) => t.clerkUserId).filter(Boolean) as string[];
  const grouped = ids.length
    ? await p.userMetric.groupBy({
        by: ["userId"],
        where: { userId: { in: ids }, eventType: "audio_complete" },
        _count: { _all: true },
      })
    : [];
  const finished = new Map(grouped.map((g) => [g.userId, g._count._all]));

  const logs = await p.betaEmailLog.findMany({ select: { signupId: true, kind: true } });
  const sent = new Map<string, Set<string>>();
  for (const l of logs) {
    const s = sent.get(l.signupId) ?? new Set<string>();
    s.add(l.kind);
    sent.set(l.signupId, s);
  }

  console.log(`Simulación a ${AHEAD} días vista (umbral feedback: ${rules.feedbackAskAfterDays}d)\n`);
  const cuenta: Record<string, number> = {};
  for (const t of testers) {
    const n = t.clerkUserId ? (finished.get(t.clerkUserId) ?? 0) : 0;
    const d = decideBetaEmail({
      tester: t as never,
      now,
      rules,
      finalRating: null,
      storiesFinished: n,
      alreadySent: sent.get(t.id) ?? new Set(),
    });
    const kind = d?.kind ?? "-";
    cuenta[kind] = (cuenta[kind] ?? 0) + 1;
    console.log(
      `  ${(t.firstName ?? "?").padEnd(16)} ${t.status.padEnd(9)} historias:${String(n).padStart(2)}  →  ${kind}`,
    );
  }
  console.log("\n  resumen:", JSON.stringify(cuenta));
  await p.$disconnect();
})();
