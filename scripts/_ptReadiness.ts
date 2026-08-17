// ¿Cuánta gente podría empezar HOY el journey de portugués? Solo lee.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const TEST_ROW = /betatest|postmigration|example\.com/i;
const PT = /portug|brasil|brazil/i;

async function main() {
  const all = (await p.betaSignup.findMany({ orderBy: { createdAt: "asc" } })).filter(
    (a) => !TEST_ROW.test(a.email)
  );
  const pt = all.filter((a) => PT.test(a.targetLanguage ?? ""));

  console.log("── Quien PIDIÓ portugués, por estado ──");
  const porEstado = new Map<string, typeof pt>();
  for (const a of pt) {
    porEstado.set(a.status, [...(porEstado.get(a.status) ?? []), a]);
  }
  for (const [estado, filas] of porEstado) {
    console.log(`  ${estado}: ${filas.length}`);
    for (const a of filas) {
      const dias = Math.round((Date.now() - a.createdAt.getTime()) / 86_400_000);
      console.log(
        `     ${(a.firstName ?? "?").padEnd(10)} ${(a.platform ?? "ios").padEnd(8)} ${a.currentLevel.padEnd(13)} hace ${dias}d`
      );
    }
  }

  // El journey PT es a0. Un principiante encaja; un intermedio se queda sin
  // nada a su nivel, porque no hay más portugués publicado ni en borrador.
  const esperando = pt.filter((a) => ["waitlist", "pending"].includes(a.status));
  const principiantes = esperando.filter((a) => /beginner/i.test(a.currentLevel));
  const iosOAmbos = esperando.filter((a) => (a.platform ?? "ios") !== "android");

  console.log("\n── De los que esperan ──");
  console.log(`  total esperando        : ${esperando.length}`);
  console.log(`  nivel Beginner (= a0)  : ${principiantes.length}`);
  console.log(`  en iOS (TestFlight ya) : ${iosOAmbos.length}`);
  console.log(
    `  listos del todo        : ${esperando.filter((a) => /beginner/i.test(a.currentLevel) && (a.platform ?? "ios") !== "android").length}`
  );

  // Y los testers YA dentro: ¿alguno pidió portugués?
  const dentro = all.filter((a) => ["invited", "accepted"].includes(a.status));
  const dentroPt = dentro.filter((a) => PT.test(a.targetLanguage ?? ""));
  console.log(`\n── Testers ya dentro: ${dentro.length} · de ellos pidieron portugués: ${dentroPt.length}`);

  // Capacidad
  const row = await p.studioConfig.findUnique({ where: { key: "beta_rules_v1" } });
  const rules = (row?.value ?? {}) as { maxActiveTesters?: number; acceptedTargetLanguages?: string[] };
  console.log(`── Huecos hasta el tope: ${Math.max(0, (rules.maxActiveTesters ?? 20) - dentro.length)}`);
  console.log(`── ¿Las reglas aceptan portugués?: ${(rules.acceptedTargetLanguages ?? []).some((l) => PT.test(l)) ? "sí" : "NO"}`);
}
main().finally(() => p.$disconnect());
