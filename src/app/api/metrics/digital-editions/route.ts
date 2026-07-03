// Métricas de activación de las ediciones digitales para el panel de dp-studio.
// Devuelve SOLO agregados (sin PII): por slug, claims emitidos (= emails de
// acceso enviados) y redimidos (= cuentas que activaron). Protegido por token
// compartido DIGITAL_STATS_TOKEN (mismo valor en Vercel y en Railway).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Slugs del catálogo del reader = SKU de las 8 ediciones digitales en Shopify.
const SLUGS = [
  "colloquial-portuguese-stories",
  "colombian-spanish-stories-for-beginners",
  "italian-short-stories-from-mysterious-venice",
  "short-stories-in-argentinian-spanish",
  "short-stories-in-argentinian-spanish-for-beginners",
  "short-stories-in-mexican-spanish",
  "spanish-short-stories-on-20-mexican-wonders",
  "short-stories-in-colombian-spanish",
];

export async function GET(req: NextRequest) {
  const expected = process.env.DIGITAL_STATS_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "DIGITAL_STATS_TOKEN not configured" }, { status: 503 });
  }
  const token = req.nextUrl.searchParams.get("token") || req.headers.get("x-stats-token");
  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const claims = await prisma.claimToken.findMany({
      where: { books: { hasSome: SLUGS } },
      select: { books: true, redeemedAt: true },
    });

    const per: Record<string, { issued: number; redeemed: number }> = {};
    for (const s of SLUGS) per[s] = { issued: 0, redeemed: 0 };
    for (const c of claims) {
      const redeemed = !!c.redeemedAt;
      for (const b of c.books || []) {
        if (!per[b]) continue;
        per[b].issued += 1;
        if (redeemed) per[b].redeemed += 1;
      }
    }

    const totals = Object.values(per).reduce(
      (t, r) => ({ issued: t.issued + r.issued, redeemed: t.redeemed + r.redeemed }),
      { issued: 0, redeemed: 0 }
    );
    const activationRate = totals.issued ? +((totals.redeemed / totals.issued) * 100).toFixed(1) : 0;

    return NextResponse.json({
      perSlug: SLUGS.map((slug) => ({ slug, ...per[slug] })),
      totals,
      activationRate,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
