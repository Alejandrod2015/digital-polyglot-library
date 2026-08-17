// Quién de la cola pasaría el listón si encendieras el auto-invite.
// Usa el evaluador real y las reglas reales. Sólo lee, no invita ni escribe.
//   npx tsx scripts/_whoCouldBeInvited.ts
import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { evaluateApplication, DEFAULT_BETA_RULES, type BetaRulesConfig } from "../src/lib/betaRules";

const p = new PrismaClient();
const TEST_ROW = /betatest|postmigration|example\.com/i;

async function main() {
  const row = await p.studioConfig.findUnique({ where: { key: "beta_rules_v1" } });
  const rules: BetaRulesConfig = { ...DEFAULT_BETA_RULES, ...((row?.value as Partial<BetaRulesConfig>) ?? {}) };
  const active = await p.betaSignup.count({ where: { status: { in: ["invited", "accepted"] } } });

  console.log(`reglas: acepta ${rules.acceptedTargetLanguages.join(", ")} · invita solo desde ${rules.autoAcceptAt} · rechaza bajo ${rules.autoDeclineBelow} · tope ${rules.maxActiveTesters}`);
  console.log(`activos ahora: ${active}\n`);

  const cola = (
    await p.betaSignup.findMany({
      where: { status: { in: ["waitlist", "pending"] } },
      orderBy: { createdAt: "asc" },
    })
  ).filter((a) => !TEST_ROW.test(a.email));

  // El auto-invite está apagado, así que el evaluador real corta antes de
  // puntuar el mérito y devuelve "switched off" para todos. Lo forzamos a
  // encendido para ver la decisión que TOMARÍA, que es la pregunta.
  const comoSiEstuviera: BetaRulesConfig = { ...rules, autoInviteEnabled: true };

  const grupos: Record<string, Array<{ email: string; nombre: string; score: number; lang: string; plat: string; motivo: string }>> = {
    invitaría: [], revisaría: [], rechazaría: [], "otro idioma": [], bloqueado: [],
  };

  for (const a of cola) {
    const v = evaluateApplication(a as never, comoSiEstuviera, { activeTesterCount: active });
    const fila = {
      email: a.email,
      nombre: a.firstName ?? "(sin nombre)",
      score: v.score,
      lang: a.targetLanguage,
      plat: a.platform ?? "ios",
      motivo: v.reason,
    };
    const acepta = rules.acceptedTargetLanguages.some((l) => l.toLowerCase() === a.targetLanguage.trim().toLowerCase());
    if (!acepta) grupos["otro idioma"].push(fila);
    else if (v.decision === "auto_accept") grupos.invitaría.push(fila);
    else if (v.decision === "auto_decline") grupos.rechazaría.push(fila);
    else if (/Waitlisted/.test(v.reason)) grupos.bloqueado.push(fila);
    else grupos.revisaría.push(fila);
  }

  for (const [nombre, filas] of Object.entries(grupos)) {
    if (!filas.length) continue;
    console.log(`══ ${nombre.toUpperCase()} · ${filas.length}`);
    for (const f of filas.sort((x, y) => y.score - x.score)) {
      console.log(`   ${String(f.score).padStart(3)}  ${f.nombre.padEnd(12)} ${f.lang.padEnd(11)} ${f.plat.padEnd(8)} ${f.email}`);
    }
    console.log();
  }

  const listos = grupos.invitaría.length;
  console.log(`→ pasarían el listón solos: ${listos}`);
  console.log(`→ huecos hasta el tope: ${Math.max(0, rules.maxActiveTesters - active)}`);
}

main().finally(() => p.$disconnect());
