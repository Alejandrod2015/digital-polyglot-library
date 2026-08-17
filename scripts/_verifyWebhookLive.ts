// Comprueba si el webhook de Clerk ha entregado algo DE VERDAD alguna vez.
// Mira las dos huellas que sólo puede dejar una entrega con firma válida.
// Sólo lee.
//   npx tsx scripts/_verifyWebhookLive.ts
import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function main() {
  const [porWebhook, revocados, ultimaAlta] = await Promise.all([
    // Sólo el handler de user.created escribe source:"clerk".
    p.userMetric.count({
      where: { eventType: "signup_completed", metadata: { path: ["source"], equals: "clerk" } },
    }),
    // Sólo el handler de user.deleted crea filas aquí (además de mi limpieza manual).
    p.revokedUser.findMany({ select: { userId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    p.userMetric.findFirst({
      where: { eventType: "signup_completed" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, metadata: true },
    }),
  ]);

  console.log("── user.created ──");
  console.log("  filas signup_completed con source 'clerk':", porWebhook);
  console.log(porWebhook > 0 ? "  ✓ el webhook ha entregado" : "  · todavía ninguna (esperado: user.created sigue sin suscribir)");
  if (ultimaAlta) {
    const m = ultimaAlta.metadata as { source?: string } | null;
    console.log("  última fila de alta:", ultimaAlta.createdAt.toISOString(), "source:", m?.source);
  }

  console.log("\n── user.deleted ──");
  console.log("  filas RevokedUser:", revocados.length);
  for (const r of revocados) {
    console.log("   ", r.createdAt.toISOString(), r.userId);
  }
  console.log("  (las de hoy con hora reciente son mi limpieza manual, no el webhook)");
}

main().finally(() => p.$disconnect());
