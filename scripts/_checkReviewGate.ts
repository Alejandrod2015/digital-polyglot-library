// En seco: simula el día del lanzamiento y comprueba que sin url de reseña el
// correo se RETIENE en vez de gastarse. No llama a ningún remitente.
import Module from "node:module";
const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, ...a: unknown[]) {
  if (r === "server-only") return {};
  return load.call(this, r, ...a);
};
import { config } from "dotenv";
config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env.local", quiet: true });

(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { decideBetaEmail } = await import("../src/lib/betaLifecycle");
  const { DEFAULT_BETA_RULES } = await import("../src/lib/betaRules");
  const { invitePlatform } = await import("../src/lib/betaProgram");
  const { playStoreUrl } = await import("../src/lib/googlePlayBeta");
  const p = new PrismaClient();

  const cfg = await p.studioConfig.findUnique({ where: { key: "beta_rules_v1" } });
  const stored = { ...DEFAULT_BETA_RULES, ...((cfg?.value as object) ?? {}) };
  console.log(`config viva: appStoreReviewUrl=${stored.appStoreReviewUrl}  playStoreUrl()=${playStoreUrl()}\n`);

  const testers = await p.betaSignup.findMany({
    where: { status: { in: ["invited", "accepted"] }, planRevokedAt: null },
    orderBy: { createdAt: "asc" },
  });

  for (const [etiqueta, appStoreReviewUrl] of [
    ["hoy: appStoreReviewUrl vacío", null],
    ["con la url puesta", "https://apps.apple.com/app/id6760942737?action=write-review"],
  ] as const) {
    const rules = { ...stored, launchedAt: "2026-09-15T00:00:00.000Z", appStoreReviewUrl };
    const now = new Date("2026-09-16T11:00:00.000Z");
    let mandados = 0;
    let retenidos = 0;
    let sinNota = 0;
    for (const t of testers) {
      const d = decideBetaEmail({
        tester: t as never, now, rules,
        finalRating: 9, engagementEvents: 99, alreadySent: new Set(),
      });
      if (d?.kind !== "review_ask") { sinNota++; continue; }
      const url = invitePlatform(t.platform) === "android" ? (playStoreUrl() ?? null) : (d.reviewUrl ?? null);
      if (!url) retenidos++; else mandados++;
    }
    console.log(`── ${etiqueta}`);
    console.log(`   se envían: ${mandados}   RETENIDOS (sin gastar el disparo): ${retenidos}   no aplica: ${sinNota}`);
  }
  await p.$disconnect();
})();
