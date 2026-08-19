// Cron del puente entre journeys: avisa al día siguiente a quien terminó un
// journey y no ha abierto el siguiente de su misma cadena. La lógica vive en
// `src/lib/journeyBridgePush.ts`; aquí solo va la autorización y el formato.
//
// SEGURO POR DEFECTO: manda de verdad solo si `JOURNEY_BRIDGE_PUSH_ENABLED`
// vale 1 en el entorno. Sin esa variable el cron corre, cuenta y devuelve el
// informe sin escribir a nadie, así que se puede desplegar y observar antes
// de que salga el primer aviso. `?dry=1` fuerza el modo seco aunque esté
// encendido.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getBridgePairs, getPartialProgress, runJourneyBridgePush, sendBridgeTest } from "@/lib/journeyBridgePush";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no-auth mode
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);

  // `?test=<clerkUserId>` manda UN aviso, con el texto real, a ese usuario y a
  // nadie mas. Es la unica forma de verlo en un telefono mientras no exista
  // una cadena con destino publicado. No deja sello, asi que se puede repetir.
  const testUserId = url.searchParams.get("test");
  if (testUserId) {
    const result = await sendBridgeTest({
      userId: testUserId,
      toJourneyId: url.searchParams.get("journey") ?? undefined,
    });
    return NextResponse.json({ test: true, ...result });
  }

  const forcedDry = /^(1|true|yes)$/i.test(url.searchParams.get("dry") ?? "");

  const report = await runJourneyBridgePush(forcedDry ? { dryRun: true } : {});

  // `?explain=1` anade el progreso parcial de cada par. Solo sirve para mirar
  // desde fuera por que hoy no hay candidatos, asi que no lo calcula el cron.
  let progress: Array<{ pair: string; total: number; top: Array<{ userId: string; done: number }> }> | undefined;
  if (/^(1|true|yes)$/i.test(url.searchParams.get("explain") ?? "")) {
    const { pairs } = await getBridgePairs();
    progress = [];
    for (const pair of pairs) {
      const { total, top } = await getPartialProgress(pair);
      progress.push({ pair: `${pair.fromLabel} -> ${pair.toLabel}`, total, top });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun: report.dryRun,
    apnsConfigured: report.apnsConfigured,
    pairs: report.pairs,
    eligible: report.candidates.filter((c) => c.eligible).length,
    skipped: report.candidates.filter((c) => c.skip).length,
    sent: report.sent,
    errors: report.errors,
    ...(progress ? { progress } : {}),
  });
}
