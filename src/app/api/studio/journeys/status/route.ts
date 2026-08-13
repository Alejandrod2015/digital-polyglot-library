// /api/studio/journeys/status
//
// Cambia el estado de un Journey (active / draft / archived) e INVALIDA la
// caché del lector en el mismo movimiento. También acepta que no le pases
// journeyId: entonces solo revalida, que es la vía para desatascar un journey
// cuyo estado ya se cambió a mano.
//
// POR QUÉ EXISTE (2026-08-13):
//   El journey de portugués estaba `active` en la base, con sus 21 historias
//   publicadas, y aun así la app respondía "No journeys available for
//   Portuguese (BRAZIL) yet.". La causa: `getStudioJourneysForLanguage` es un
//   `unstable_cache` con el tag `published-journey-stories`, y ese tag SOLO se
//   invalidaba al publicar una HISTORIA (/api/studio/journeys/publish). Sacar
//   un JOURNEY de borrador no invalidaba nada, así que el lector seguía
//   sirviendo la respuesta vacía de cuando era borrador. El síntoma es
//   especialmente traicionero porque /api/mobile/languages NO tiene caché: el
//   idioma aparecía seleccionable y el paso siguiente salía vacío.
//
//   Cualquier cambio de estado de un journey debe pasar por aquí. Hacerlo con
//   un script suelto contra la base vuelve a dejar el lector desfasado hasta
//   que caduque el TTL, y el TTL no lo salva: la entrada caducada se sirve
//   igualmente mientras revalida por detrás.
//
// Auth: sesión de Studio, o `Authorization: Bearer <CRON_SECRET>` para que los
// scripts puedan llamarlo sin navegador.

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["active", "draft", "archived"] as const;
type AllowedStatus = (typeof ALLOWED_STATUS)[number];

async function isAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;

  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  return Boolean(email && (await isStudioMember(email)));
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { journeyId?: unknown; status?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Sin cuerpo = solo revalidar. Es el caso de "desatasca lo que ya cambié".
  }

  const journeyId = typeof body.journeyId === "string" ? body.journeyId : null;
  const status = typeof body.status === "string" ? (body.status as AllowedStatus) : null;

  if (journeyId && !status) {
    return NextResponse.json(
      { error: `Falta status. Valores válidos: ${ALLOWED_STATUS.join(", ")}` },
      { status: 400 }
    );
  }
  if (status && !ALLOWED_STATUS.includes(status)) {
    return NextResponse.json(
      { error: `status inválido: ${status}. Válidos: ${ALLOWED_STATUS.join(", ")}` },
      { status: 400 }
    );
  }

  let changed: { id: string; name: string; language: string; variant: string; from: string; to: string } | null = null;

  if (journeyId && status) {
    const before = await prisma.journey.findUnique({
      where: { id: journeyId },
      select: { id: true, name: true, language: true, variant: true, status: true },
    });
    if (!before) {
      return NextResponse.json({ error: `No existe el journey ${journeyId}` }, { status: 404 });
    }
    await prisma.journey.update({ where: { id: journeyId }, data: { status } });
    changed = {
      id: before.id,
      name: before.name,
      language: before.language,
      variant: before.variant,
      from: before.status,
      to: status,
    };
  }

  revalidateTag("published-journey-stories");

  // Devolvemos lo que el lector debería ver a partir de ahora, para poder
  // comprobar el efecto sin abrir la app: un journey activo con 0 historias
  // publicadas sale igual de vacío que uno inexistente, y esa distinción es
  // justo la que costó una tarde localizar.
  const live = await prisma.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    select: {
      id: true,
      name: true,
      language: true,
      variant: true,
      _count: { select: { stories: { where: { status: "published" } } } },
    },
    orderBy: [{ language: "asc" }, { variant: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    changed,
    revalidated: "published-journey-stories",
    live: live.map((j) => ({
      id: j.id,
      name: j.name,
      language: j.language,
      variant: j.variant,
      publishedStories: j._count.stories,
    })),
  });
}
