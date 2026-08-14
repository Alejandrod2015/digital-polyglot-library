// Cambia el estado de un journey (active / draft / archived) SIN dejar el
// lector desfasado.
//
// POR QUÉ ES EL CAMINO CANÓNICO (2026-08-13):
//   Cambiar `Journey.status` con Prisma a secas deja la app mostrando el
//   estado viejo indefinidamente. `getStudioJourneysForLanguage` es un
//   `unstable_cache` con el tag `published-journey-stories`, y ese tag solo lo
//   invalidaba /api/studio/journeys/publish, o sea publicar una HISTORIA.
//   Sacar un JOURNEY de borrador no invalidaba nada. Fue exactamente lo que
//   pasó con el portugués: 21 historias publicadas, journey `active`, y la app
//   respondiendo "No journeys available for Portuguese (BRAZIL) yet.".
//   Peor todavía: /api/mobile/languages NO tiene caché, así que el idioma sí
//   aparecía seleccionable y solo el paso siguiente salía vacío.
//
// Uso:
//   npx tsx scripts/setJourneyStatus.ts <journeyId> <active|draft|archived>
//   npx tsx scripts/setJourneyStatus.ts --revalidate     (solo refrescar)
//
// Para que revalide hace falta poder llamar al endpoint. Dos vías:
//   CRON_SECRET  en el entorno (la que usan los crons), y
//   DPL_APP_URL  si el destino no es producción.
// Si no hay forma de llamarlo, el script AVISA y te deja la orden exacta:
// escribir el estado y callarse sería repetir el fallo.

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { checkSelectorFindsVariant } from "./selectorVariants";

const prisma = new PrismaClient();
const APP_URL = (process.env.DPL_APP_URL ?? "https://reader.digitalpolyglot.com").replace(/\/$/, "");
const ENDPOINT = `${APP_URL}/api/studio/journeys/status`;
const ALLOWED = ["active", "draft", "archived"] as const;
type Status = (typeof ALLOWED)[number];

async function revalidar(payload: Record<string, unknown>): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`  el endpoint respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    const data = (await res.json()) as { live?: Array<{ language: string; variant: string; name: string; publishedStories: number }> };
    console.log("  caché invalidada. Lo que el lector ve ahora:");
    for (const j of data.live ?? []) {
      console.log(`    ${j.language} · ${j.variant} · ${j.name} → ${j.publishedStories} historias publicadas`);
    }
    return true;
  } catch (err) {
    console.error("  no se pudo llamar al endpoint:", err instanceof Error ? err.message : err);
    return false;
  }
}

function avisoManual(payload: Record<string, unknown>) {
  console.log("\n⚠  LA APP TODAVÍA NO LO VE.");
  console.log("   Falta invalidar la caché del lector. Sin CRON_SECRET en el entorno,");
  console.log("   hazlo desde el navegador con la sesión de Studio abierta:");
  console.log(`\n     fetch("${ENDPOINT}", { method: "POST", headers: { "Content-Type": "application/json" },`);
  console.log(`       body: JSON.stringify(${JSON.stringify(payload)}) }).then(r => r.json()).then(console.log)\n`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--revalidate") {
    console.log("Solo revalidar (no se toca ningún estado).");
    if (!(await revalidar({}))) avisoManual({});
    return;
  }

  const [journeyId, status] = args;
  if (!journeyId || !status) {
    console.error("Uso: npx tsx scripts/setJourneyStatus.ts <journeyId> <active|draft|archived>");
    console.error("     npx tsx scripts/setJourneyStatus.ts --revalidate");
    process.exit(1);
  }
  if (!ALLOWED.includes(status as Status)) {
    console.error(`status inválido: ${status}. Válidos: ${ALLOWED.join(", ")}`);
    process.exit(1);
  }

  const j = await prisma.journey.findUnique({
    where: { id: journeyId },
    select: { id: true, name: true, language: true, variant: true, status: true },
  });
  if (!j) {
    console.error(`No existe el journey ${journeyId}`);
    process.exit(1);
  }

  const publicadas = await prisma.journeyStory.count({
    where: { journeyId: j.id, status: "published" },
  });

  console.log(`${j.name} · ${j.language} · ${j.variant}`);
  console.log(`  ${j.status} → ${status}   (historias publicadas: ${publicadas})`);

  // Un journey activo sin historias publicadas se ve igual de vacío que uno
  // que no existe. Decirlo aquí ahorra el siguiente rato de diagnóstico.
  if (status === "active" && publicadas === 0) {
    console.log("  ⚠  activo con 0 historias publicadas: en la app se verá vacío igual.");
  }

  // GUARD DE VARIANTE. Publicar un journey cuya variante el selector no sabe
  // encontrar equivale a no publicarlo, pero SIN decirlo: la app muestra "No
  // journeys available" igual que si no hubiera contenido. Es exactamente lo
  // que pasó con el portugués de Brasil el 2026-08-13. Se bloquea antes de
  // escribir, porque después el síntoma es indistinguible de un problema de
  // datos y cuesta una tarde localizarlo.
  if (status === "active") {
    const check = checkSelectorFindsVariant(j.language, j.variant);
    if (!check.ok) {
      console.error("\n✗ EL SELECTOR DE LA APP NO ENCONTRARÍA ESTE JOURNEY");
      console.error(`  ${check.reason}`);
      console.error("\n  No se ha cambiado nada. Arregla el emparejamiento y vuelve a intentarlo.");
      console.error("  Para ver el mapa completo: npx tsx scripts/_variantMatchAudit.ts");
      process.exit(1);
    }
    console.log(`  selector: lo encuentra (${check.reason}).`);
  }

  if (j.status === status) {
    console.log("  ya estaba en ese estado; solo se revalida.");
  } else {
    await prisma.journey.update({ where: { id: j.id }, data: { status } });
    console.log("  estado escrito.");
  }

  if (!(await revalidar({ journeyId: j.id, status }))) avisoManual({ journeyId: j.id, status });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
