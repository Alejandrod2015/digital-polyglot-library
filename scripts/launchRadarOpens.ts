/**
 * APERTURAS DEL BOLETIN, solo lectura. No manda ni un correo.
 *
 *   npx tsx scripts/launchRadarOpens.ts --kind improvement --desde 2026-09-20
 *
 * Pregunta a Resend el ultimo evento de cada envio registrado en
 * `BetaEmailLog` y cuenta por estado. El numero de `opened` es el que entra
 * en `scripts/launchRadar.ts --abiertos N`.
 *
 * DOS AVISOS QUE HAY QUE REPETIR AL INFORMAR:
 * 1. Resend devuelve SOLO el ultimo evento, asi que un clic posterior tapa la
 *    apertura: `opened` es un SUELO, y los clics no se ven por esta via.
 * 2. El guard 6f de `.claude/safety/pre-bash-guard.sh` bloquea cualquier
 *    comando que toque el dominio de Resend, incluida esta lectura. Lo corre
 *    el usuario en su terminal; no se salta con ninguna variable.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
};

(async () => {
  const kind = arg("kind") ?? "improvement";
  const desde = new Date(arg("desde") ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
  const logs = await p.betaEmailLog.findMany({
    where: { kind, sentAt: { gte: desde } },
    select: { providerId: true, sentAt: true },
    orderBy: { sentAt: "asc" },
  });
  console.log(`envios de tipo "${kind}" desde ${desde.toISOString().slice(0, 10)}: ${logs.length}`);

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("falta RESEND_API_KEY en .env.local");
    await p.$disconnect();
    process.exit(1);
  }
  const cuenta: Record<string, number> = {};
  for (const l of logs) {
    if (!l.providerId) {
      cuenta.sin_id = (cuenta.sin_id ?? 0) + 1;
      continue;
    }
    const r = await fetch(`https://api.resend.com/emails/${l.providerId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      cuenta[`http_${r.status}`] = (cuenta[`http_${r.status}`] ?? 0) + 1;
      continue;
    }
    const j = (await r.json()) as { last_event?: string };
    const ev = j.last_event ?? "?";
    cuenta[ev] = (cuenta[ev] ?? 0) + 1;
  }
  console.table(cuenta);
  console.log("recuerda: 'opened' es un suelo, no el dato exacto.");
  await p.$disconnect();
})();
