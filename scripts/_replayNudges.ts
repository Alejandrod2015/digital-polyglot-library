// En seco: reconstruye el dato real de cada persona que recibio un nudge y
// pregunta al porton nuevo si habria salido. No envia nada.
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
  const { buildLifecycleData } = await import("../src/lib/emails/userLifecycleData");
  const { hasRealDataFor } = await import("../src/lib/emails/lifecycle");
  const p = new PrismaClient();

  const rows = await p.userMetric.findMany({ where: { eventType: "lifecycle_email_sent" }, select: { userId:true, metadata:true, createdAt:true } });
  const nudges = rows.filter(r => (r.metadata as any)?.kind === "nudge");
  let salen = 0, frenan = 0;
  for (const n of nudges) {
    const d = await buildLifecycleData(n.userId).catch(() => ({}));
    const sale = hasRealDataFor("nudge", d as never);
    const fs = (d as any).firstStory;
    const correo = (n.metadata as any)?.to ?? n.userId.slice(0,16);
    console.log(
      `  ${String(correo).padEnd(34)} inProgress=${String(fs?.inProgress ?? "-").padEnd(5)} pct=${String(fs?.percentRead ?? "-").padEnd(4)} -> ${sale ? "sale" : "FRENA"}`,
    );
    sale ? salen++ : frenan++;
  }
  console.log(`\n  de los ${nudges.length} nudges enviados: seguirian saliendo ${salen}, se frenan ${frenan}`);
  await p.$disconnect();
})();
