/**
 * Migracion de datos: Journey.variant "latam" -> "latam-multi" para los 6
 * journeys tour pan-regional (Traveler ES a0/a1/a2/b1/b2, Friends ES c1) mas
 * el draft Cultural a0. Decision del usuario, ver TAXONOMIA_variantes_latam
 * (2026-09-19).
 *
 * Uso:
 *   npx tsx scripts/migrateLatamMulti.ts            # --dry implicito, solo informa
 *   npx tsx scripts/migrateLatamMulti.ts --dry       # igual, explicito
 *   npx tsx scripts/migrateLatamMulti.ts --post-deploy   # ESCRIBE
 *
 * `--post-deploy` es obligatorio para escribir, y el nombre no es cosmetico:
 * el cambio de Journey.variant en BD SOLO puede correr DESPUES de que el
 * deploy web (dominio, languageFlags, JourneyClient, slug aliases,
 * validador, studio fallbacks) y la build movil (LanguageFlag/regionFamily,
 * onboarding) esten publicados. Antes de eso, cambiar el campo en BD deja
 * flags y filtros de variante rotos en produccion para todo el que no haya
 * actualizado. Sin --post-deploy, el script SIEMPRE corre en modo --dry sin
 * excepcion, ni con variables de entorno.
 *
 * No toca Friends A1 (cmu7f663l0007j87p36m70mp6, ya es variant="chile") ni
 * ningun journey archived.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

// Los 7 journeys que migran: 6 live + el draft Cultural a0. Friends A1 NO
// entra (ya es "chile"); los archived no cuentan para nada de esto.
const JOURNEY_IDS_TO_MIGRATE = [
  "cmqrtaj1p000032qtda86z6um", // Traveler a0 (live)
  "cmt5vxwgd0007324oesy195k8", // Traveler a1 (live)
  "cmtgelq560007j84n3ujx9bpd", // Traveler a2 (live)
  "cmtmylg7k0007321h6t7njesx", // Traveler b1 (live)
  "cmtpls1l20007j8epwgcs6e1h", // Traveler b2 (live)
  "cmrdqk484000032r4rt2vw4ej", // Friends c1 (live)
  "cmu410zep000732szrw94t2sl", // Cultural a0 (draft)
];

const SPANISH_LANGUAGE_ID = "cmnlt3q9j000032pjhrd3ypec";

async function main() {
  const postDeploy = process.argv.includes("--post-deploy");
  const write = postDeploy && !process.argv.includes("--dry");

  console.log(write ? "MODO: ESCRIBE (--post-deploy sin --dry)" : "MODO: --dry (informe, sin tocar nada)");
  console.log("");

  const journeys = await prisma.journey.findMany({
    where: { id: { in: JOURNEY_IDS_TO_MIGRATE } },
    select: { id: true, name: true, levels: true, status: true, variant: true },
  });

  console.log("Journey.variant, antes -> despues:");
  for (const id of JOURNEY_IDS_TO_MIGRATE) {
    const j = journeys.find((x) => x.id === id);
    if (!j) {
      console.log(`  ${id}: NO ENCONTRADO EN BD. NO se toca. Reporta esta discrepancia antes de seguir.`);
      continue;
    }
    if (j.variant !== "latam") {
      console.log(
        `  ${id} (${j.name} ${j.levels.join("/")}, ${j.status}): variant actual="${j.variant}", ` +
          `ESPERADO "latam". Estado distinto del declarado: NO se toca, revisar antes de --post-deploy.`
      );
      continue;
    }
    console.log(`  ${id} (${j.name} ${j.levels.join("/")}, ${j.status}): "latam" -> "latam-multi"`);
  }

  const beta = await prisma.betaSignup.count({ where: { targetVariant: "latam" } });
  console.log(
    `\nBetaSignup.targetVariant="latam": ${beta} filas. NO se tocan: la preferencia sigue usando el codigo ` +
      `"latam" (neutral es la interpretacion nueva de ese mismo codigo); el pool de vocab comparte "latam" y ` +
      `"latam-multi", asi que estos usuarios siguen viendo los 6 journeys sin cambio de comportamiento.`
  );

  const existingVariantRow = await prisma.languageVariant.findFirst({
    where: { languageId: SPANISH_LANGUAGE_ID, code: "latam-multi" },
  });
  console.log(
    existingVariantRow
      ? `\nFila LanguageVariant code="latam-multi": ya existe (${existingVariantRow.id}). No se crea de nuevo.`
      : `\nFila LanguageVariant code="latam-multi": NO existe. ${write ? "Se crea ahora." : "Se crearia con --post-deploy."}`
  );

  if (!write) {
    console.log("\n--dry: no se escribio nada. Corre con --post-deploy (y sin --dry) DESPUES del deploy web + build movil.");
    await prisma.$disconnect();
    return;
  }

  const toUpdate = journeys.filter((j) => j.variant === "latam" && JOURNEY_IDS_TO_MIGRATE.includes(j.id));
  if (toUpdate.length !== JOURNEY_IDS_TO_MIGRATE.length) {
    console.error(
      `\nABORTA: se esperaban ${JOURNEY_IDS_TO_MIGRATE.length} journeys con variant="latam" y solo hay ` +
        `${toUpdate.length}. No se escribe nada; revisa el informe de arriba.`
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$transaction([
    ...toUpdate.map((j) =>
      prisma.journey.update({ where: { id: j.id }, data: { variant: "latam-multi" } })
    ),
    ...(existingVariantRow
      ? []
      : [
          prisma.languageVariant.create({
            data: {
              languageId: SPANISH_LANGUAGE_ID,
              code: "latam-multi",
              label: "Latam (Multi-Country)",
              sortOrder: 1,
            },
          }),
        ]),
  ]);

  console.log(`\nEscrito: ${toUpdate.length} journeys migrados a "latam-multi".`);
  console.log(
    "Falta invalidar cache (published-journey-stories): llama a las rutas de publish/status, o " +
      "espera hasta 300s (revalidate) a que se sirva el valor nuevo."
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
