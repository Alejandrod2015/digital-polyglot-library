// Los mismos agregados que pinta la pestaña Demand, en texto, para poder
// leerlos sin pasar por el login de Studio. Solo lee.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const TEST_ROW = /betatest|postmigration|example\.com/i;

function tally<T>(rows: T[], pick: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (pick(r) ?? "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function show(titulo: string, filas: Array<[string, number]>, total: number) {
  console.log(`\n── ${titulo}`);
  if (!filas.length) return console.log("   (sin datos)");
  for (const [k, n] of filas) console.log(`   ${k.padEnd(24)} ${String(n).padStart(3)}  ${Math.round((n / total) * 100)}%`);
}

async function main() {
  const all = (await p.betaSignup.findMany({ orderBy: { createdAt: "desc" } })).filter(
    (a) => !TEST_ROW.test(a.email)
  );
  const total = all.length;
  const esperando = all.filter((a) => ["waitlist", "pending"].includes(a.status));
  console.log(`${total} solicitudes · ${esperando.length} esperando`);

  show("Qué idioma quieren", tally(all, (a) => a.targetLanguage), total);
  show("De dónde son", tally(all, (a) => (a.attribution as { country?: string } | null)?.country), total);
  show("Con qué teléfono", tally(all, (a) => a.platform ?? "ios"), total);
  show("Desde qué nivel", tally(all, (a) => a.currentLevel), total);
  show("Cuánto tiempo dicen tener", tally(all, (a) => a.weeklyHours), total);
  show("Para qué lo quieren", tally(all, (a) => a.motivation), total);
  show("Por dónde llegaron", tally(all, (a) => a.referralSource), total);
  show("Qué idioma hablan ya", tally(all, (a) => a.nativeLanguage), total);

  console.log("\n── Región del idioma, por idioma");
  for (const [lang, n] of tally(all, (a) => a.targetLanguage)) {
    const filas = all.filter((a) => a.targetLanguage === lang);
    const sinPreguntar = filas.filter((a) => !a.targetVariant).length;
    const v = tally(filas, (a) => a.targetVariant);
    console.log(`   ${lang} (${n})${sinPreguntar ? ` · ${sinPreguntar} sin preguntar` : ""}: ${v.length ? v.map(([k, c]) => `${k}=${c}`).join(", ") : "a nadie se le preguntó"}`);
  }
}
main().finally(() => p.$disconnect());
