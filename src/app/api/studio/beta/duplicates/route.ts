// Posibles cuentas duplicadas para el panel manual de /studio/beta.
//
// GET  → candidatos ordenados por puntaje (ver src/lib/duplicateAccountCandidates.ts).
// POST → fusiona la ACTIVIDAD (no la cuenta ni el login) de un par que un
//        admin confirmó a ojo. Ver src/lib/mergeMetricsUserId.ts para el
//        alcance exacto de qué mueve y qué deja intacto.

import { NextRequest, NextResponse } from "next/server";
import { requireBetaAdmin } from "@/lib/studioBetaAuth";
import { findDuplicateCandidates } from "@/lib/duplicateAccountCandidates";
import { mergeMetricsUserId } from "@/lib/mergeMetricsUserId";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const candidates = await findDuplicateCandidates();
  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  const alias = body?.aliasUserId;
  const canon = body?.canonicalUserId;
  if (typeof alias !== "string" || typeof canon !== "string") {
    return NextResponse.json({ error: "aliasUserId y canonicalUserId son requeridos" }, { status: 400 });
  }

  try {
    const result = await mergeMetricsUserId(prisma as unknown as PrismaClient, alias, canon);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error desconocido" }, { status: 400 });
  }
}
