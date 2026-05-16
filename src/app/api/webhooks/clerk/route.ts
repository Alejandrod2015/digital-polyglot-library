import { Webhook } from "svix";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type UserDeletedEvent = {
  type: "user.deleted";
  data: { id: string };
};

type UserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    created_at?: number;
    email_addresses?: Array<{ email_address?: string }>;
    primary_email_address_id?: string;
  };
};

function isUserDeletedEvent(evt: unknown): evt is UserDeletedEvent {
  if (typeof evt !== "object" || evt === null) return false;
  const e = evt as Record<string, unknown>;
  if (e.type !== "user.deleted") return false;
  const data = e.data as Record<string, unknown> | undefined;
  return typeof data?.id === "string";
}

function isUserCreatedEvent(evt: unknown): evt is UserCreatedEvent {
  if (typeof evt !== "object" || evt === null) return false;
  const e = evt as Record<string, unknown>;
  if (e.type !== "user.created") return false;
  const data = e.data as Record<string, unknown> | undefined;
  return typeof data?.id === "string";
}

function pickPrimaryEmail(evt: UserCreatedEvent): string | null {
  const list = evt.data.email_addresses ?? [];
  if (!list.length) return null;
  const primaryId = evt.data.primary_email_address_id;
  const primary = primaryId
    ? list.find((e) => (e as { id?: string }).id === primaryId)
    : list[0];
  return primary?.email_address ?? null;
}

export async function POST(req: Request) {
  const payload = await req.text();

  // Usa los headers del Request para evitar conflictos de tipos con next/headers
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);

  try {
    const eventUnknown = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });

    if (isUserDeletedEvent(eventUnknown)) {
      const userId = eventUnknown.data.id;

      await prisma.$transaction([
        prisma.favorite.deleteMany({ where: { userId } }),
        prisma.libraryBook.deleteMany({ where: { userId } }),
        prisma.libraryStory.deleteMany({ where: { userId } }),
        prisma.userStory.deleteMany({ where: { userId } }),
        prisma.claimToken.updateMany({
          where: { redeemedBy: userId },
          data: { redeemedBy: null },
        }),
      ]);

      console.log(`🧹 Datos del usuario ${userId} eliminados/anonimizados`);
    }

    if (isUserCreatedEvent(eventUnknown)) {
      const userId = eventUnknown.data.id;
      const email = pickPrimaryEmail(eventUnknown);
      const createdAtMs = eventUnknown.data.created_at;
      // Surface the signup as a UserMetric event so the Studio dashboard
      // can count signups alongside the rest of the funnel.
      await prisma.userMetric.create({
        data: {
          userId,
          storySlug: "__auth__",
          bookSlug: "signup",
          eventType: "signup_completed",
          metadata: {
            email,
            source: "clerk",
            createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
          },
        },
      });
      console.log(`✅ Signup tracked for ${userId}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("❌ Clerk webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
