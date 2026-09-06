import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";
import { serializeEntitlement } from "@/lib/billing";
import {
  resolveEffectivePlan,
  type EffectivePlan,
  type Plan,
} from "@domain/access";

/**
 * Resolucion del plan EFECTIVO en el servidor (modelo 2026-09): entitlement o
 * publicMetadata.plan, mas la gracia beta por fecha de creacion de la cuenta.
 * Toda ruta que gatee contenido debe pasar por aqui, no por el plan crudo.
 */

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

function isPlan(value: unknown): value is Exclude<Plan, undefined> {
  return (
    value === "free" ||
    value === "basic" ||
    value === "premium" ||
    value === "polyglot" ||
    value === "owner"
  );
}

export async function getEffectivePlanForUserId(
  userId: string | null | undefined
): Promise<EffectivePlan> {
  if (!userId) return "free";

  const [entitlement, user] = await Promise.all([
    prisma.billingEntitlement.findUnique({ where: { userId } }).catch(() => null),
    clerkClient.users.getUser(userId).catch(() => null),
  ]);

  const metadataPlan = user?.publicMetadata?.plan;
  const plan = isPlan(metadataPlan) ? metadataPlan : serializeEntitlement(entitlement).plan;

  return resolveEffectivePlan({
    plan,
    isSignedIn: true,
    userCreatedAtMs: typeof user?.createdAt === "number" ? user.createdAt : null,
  });
}

/** La historia pertenece al PRIMER tema de su journey (el suelo gratuito de basic). */
export async function isFirstTopicStorySlug(slug: string): Promise<boolean> {
  if (!slug) return false;
  const row = await prisma.journeyStory
    .findFirst({
      where: { slug, status: "published" },
      select: { topic: true, journey: { select: { topics: true } } },
    })
    .catch(() => null);
  if (!row) return false;
  const firstTopic = row.journey.topics[0];
  return typeof firstTopic === "string" && firstTopic === row.topic;
}
