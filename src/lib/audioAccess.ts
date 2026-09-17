import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { getEffectivePlanForUserId, isFirstTopicStorySlug } from "@/lib/effectiveAccess";
import { isDailyStorySlug } from "@/lib/dailyJourneyStory";
import { isEntitledPlan, type EffectivePlan } from "@domain/access";

/**
 * Quien pide audio por la API y con que plan EFECTIVO. Acepta las dos
 * sesiones que existen: la cookie de Clerk (web) y el Bearer del movil.
 * Sin sesion, el plan es "free": el mismo muro 2026-09 que ya aplican las
 * paginas, aplicado por fin en la API (antes cualquier anonimo se llevaba
 * los audioUrl de todo el catalogo).
 */
export type AudioViewer = { userId: string | null; plan: EffectivePlan };

export async function getAudioViewerFromRequest(req: NextRequest): Promise<AudioViewer> {
  const { userId } = await auth();
  const effectiveUserId = userId ?? (await getActiveMobileSession(req))?.sub ?? null;
  const plan = await getEffectivePlanForUserId(effectiveUserId);
  return { userId: effectiveUserId, plan };
}

/**
 * Mismo modelo que canAccessStoryContent, restringido a lo que un endpoint
 * de audio necesita: entitled oye todo; todos oyen la historia del dia;
 * basic oye ademas el primer tema de su journey.
 */
export async function canHearStorySlug(viewer: AudioViewer, slug: string): Promise<boolean> {
  if (isEntitledPlan(viewer.plan)) return true;
  if (await isDailyStorySlug(slug)) return true;
  if (viewer.plan === "basic" && (await isFirstTopicStorySlug(slug))) return true;
  return false;
}

/** Filtra en lote; para un plan entitled no consulta nada. */
export async function filterHearableSlugs(
  viewer: AudioViewer,
  slugs: string[]
): Promise<Set<string>> {
  if (isEntitledPlan(viewer.plan)) return new Set(slugs);
  const hearable = new Set<string>();
  for (const slug of slugs) {
    if (await canHearStorySlug(viewer, slug)) hearable.add(slug);
  }
  return hearable;
}
