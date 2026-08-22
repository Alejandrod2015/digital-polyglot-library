// Cron de "historia a medias": recuerda una vez la historia que el alumno dejó
// entre el 20% y el 85% y no ha retomado. La lógica vive en
// `src/lib/resumeStoryPush.ts`; aquí solo van la autorización y el formato.
//
// SEGURO POR DEFECTO: manda de verdad solo si `RESUME_STORY_PUSH_ENABLED` vale
// 1 en el entorno. Sin esa variable el cron corre, cuenta y devuelve el informe
// sin escribir a nadie, así que se puede desplegar y observar antes de que
// salga el primer aviso. `?dry=1` fuerza el modo seco aunque esté encendido.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { runResumeStoryPush, sendResumeTest, type ResumeSkipReason } from "@/lib/resumeStoryPush";

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
  // nadie más. No deja sello, así que se puede repetir.
  const testUserId = url.searchParams.get("test");
  if (testUserId) {
    const result = await sendResumeTest({
      userId: testUserId,
      storySlug: url.searchParams.get("story") ?? undefined,
    });
    return NextResponse.json({ test: true, ...result });
  }

  const forcedDry = /^(1|true|yes)$/i.test(url.searchParams.get("dry") ?? "");
  const report = await runResumeStoryPush(forcedDry ? { dryRun: true } : {});

  // El desglose de descartes es la parte que se mira a diario: dice si el
  // disparador no encuentra a nadie porque no hay historias a medias o porque
  // se las está comiendo un filtro.
  const skipped: Partial<Record<ResumeSkipReason, number>> = {};
  for (const candidate of report.candidates) {
    if (!candidate.skip) continue;
    skipped[candidate.skip] = (skipped[candidate.skip] ?? 0) + 1;
  }

  const eligible = report.candidates.filter((c) => c.eligible);

  return NextResponse.json({
    ok: true,
    dryRun: report.dryRun,
    apnsConfigured: report.apnsConfigured,
    rows: report.rows,
    eligible: eligible.length,
    skipped,
    // En seco, el texto exacto que habrían recibido: es lo que se lee antes de
    // encender el interruptor.
    preview: eligible.slice(0, 10).map((c) => ({
      userId: c.userId,
      storySlug: c.storySlug,
      ratio: c.ratio,
      hoursSince: c.hoursSince,
      title: c.title,
      body: c.body,
    })),
    sent: report.sent,
    errors: report.errors,
  });
}
