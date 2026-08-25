/**
 * Reproduce el pipeline EXACTO de /api/mobile/journey para un usuario, usando
 * las funciones reales (no copias), y dice en que track aterriza su app.
 *   npx tsx scripts/_validaTy.ts <email>
 */
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const __p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[__p] = {
    id: __p, filename: __p, loaded: true, exports: {},
  };
} catch { /* noop */ }

// `journeyData` envuelve sus queries en `unstable_cache`, que fuera de una
// request de Next tira "incrementalCache missing". Se sustituye por la funcion
// pelada: la consulta y el orden que se prueban siguen siendo los reales, solo
// se quita la capa de cache.
try {
  const __c = __req.resolve("next/cache");
  const __real = __req(__c) as Record<string, unknown>;
  (__req as unknown as { cache: Record<string, { exports: unknown }> }).cache[__c] = {
    ...(__req as unknown as { cache: Record<string, { exports: unknown }> }).cache[__c],
    exports: { ...__real, unstable_cache: (fn: unknown) => fn },
  } as { exports: unknown };
} catch { /* noop */ }

// Dinamicos a proposito: los `import` estaticos se ejecutan ANTES del shim de
// arriba y `src/lib/prisma` revienta al cargar `server-only`.
// publicMetadata REAL de Ty, leida de Clerk produccion el 2026-08-25.
const META: Record<string, unknown> = {
  journeyPlacementLevel: "b2",
  preferredLevel: "Intermediate",
  preferredVariant: null,
  journeys: null,
  targetLanguages: ["Spanish"],
};

async function load() {
  const [journeyData, order, langVariant, learner, onboarding, prismaMod] = await Promise.all([
    import("../src/app/journey/journeyData"),
    import("../src/lib/journeyTrackOrder"),
    import("../src/lib/languageVariant"),
    import("../src/lib/learnerVariant"),
    import("../src/lib/onboarding"),
    import("../src/lib/prisma"),
  ]);
  return {
    buildJourneyVariants: journeyData.buildJourneyVariants,
    orderTracksByPlacement: order.orderTracksByPlacement,
    variantMatchesPreference: langVariant.variantMatchesPreference,
    resolveLearnerVariant: learner.resolveLearnerVariant,
    getJourneyVariantFromPreferences: onboarding.getJourneyVariantFromPreferences,
    prisma: prismaMod.prisma,
  };
}

async function main() {
  const {
    buildJourneyVariants, orderTracksByPlacement, variantMatchesPreference,
    resolveLearnerVariant, getJourneyVariantFromPreferences, prisma,
  } = await load();
  const email = process.argv[2] ?? "ty@tystober.com";
  const signup = await prisma.betaSignup.findFirst({ where: { email } });
  const language = "Spanish";

  const learnerVariant = await resolveLearnerVariant({
    language,
    publicMetadata: META,
    clerkUserId: signup?.clerkUserId ?? null,
    emails: [email],
  });
  const placement = typeof META.journeyPlacementLevel === "string" ? META.journeyPlacementLevel : null;

  const rawTracks = await buildJourneyVariants(language);
  const matching = learnerVariant
    ? rawTracks.filter((t) => variantMatchesPreference(learnerVariant, t.variant))
    : rawTracks;
  const served = matching.length > 0 ? matching : rawTracks;
  const tracks = orderTracksByPlacement(served, placement, learnerVariant);

  // Lo que hace el cliente <= build 314, copiado de MobileLibraryShell.
  const preferredVariantKey = String(
    getJourneyVariantFromPreferences(
      language,
      META.preferredVariant as string | null,
      (META as Record<string, unknown>).preferredRegion as string | null
    ) ?? ""
  ).trim().toLowerCase();
  const baseTrack =
    (preferredVariantKey
      ? tracks.find((t) => (t.variant ?? "").trim().toLowerCase() === preferredVariantKey)
      : null) ?? tracks[0] ?? null;

  const show = (t: (typeof tracks)[number] | null) =>
    t ? `${t.label} / ${t.variant} / ${t.levels.map((l) => l.id).join("+").toUpperCase()}` : "NINGUNO";

  console.log("email                :", email);
  console.log("BetaSignup.targetVariant:", signup?.targetVariant ?? null);
  console.log("learnerVariant (real):", learnerVariant);
  console.log("placement            :", placement);
  console.log("preferredVariantKey del cliente:", JSON.stringify(preferredVariantKey), preferredVariantKey ? "" : "(vacio -> coge tracks[0])");
  console.log("tracks servidos      :", rawTracks.length, "->", served.length, "tras el filtro de variante");
  console.log("\nOrden servido:");
  tracks.forEach((t, i) => console.log(`  ${i}. ${show(t)}`));
  console.log("\n>>> SU APP ATERRIZA EN:", show(baseTrack));

  const primeraHistoria = baseTrack?.levels[0]?.topics[0]?.stories[0];
  console.log(">>> primera historia   :", primeraHistoria ? `${primeraHistoria.title} (${primeraHistoria.slug})` : "?");
}
main().finally(() => prisma.$disconnect());
