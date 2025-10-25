import { Webhook } from "svix";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type UserDeletedEvent = {
  type: "user.deleted";
  data: { id: string };
};

function isUserDeletedEvent(evt: unknown): evt is UserDeletedEvent {
  if (typeof evt !== "object" || evt === null) return false;
  const e = evt as Record<string, unknown>;
  if (e.type !== "user.deleted") return false;
  const data = e.data as Record<string, unknown> | undefined;
  return typeof data?.id === "string";
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

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("❌ Clerk webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
