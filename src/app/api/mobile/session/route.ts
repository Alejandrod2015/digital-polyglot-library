import { createClerkClient, verifyToken } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { createMobileSessionToken } from "@/lib/mobileSession";
import { prisma } from "@/lib/prisma";
import { touchTesterActivity } from "@/lib/betaProgram";
import { mobilePlatformFromRequest } from "@/lib/mobilePlatform";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function POST(req: NextRequest) {
  try {
    const clerkSessionToken = getBearerToken(req);
    if (!clerkSessionToken) {
      return NextResponse.json({ error: "Missing Clerk session token." }, { status: 401 });
    }

    const verified = await verifyToken(clerkSessionToken, {
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: process.env.CLERK_JWT_KEY,
    });

    const userId = typeof verified.sub === "string" ? verified.sub : "";
    if (!userId) {
      return NextResponse.json({ error: "Invalid Clerk session token." }, { status: 401 });
    }

    const [user, savedBooksCount, savedStoriesCount] = await Promise.all([
      clerkClient.users.getUser(userId),
      prisma.libraryBook.count({ where: { userId } }),
      prisma.libraryStory.count({ where: { userId } }),
    ]);

    const publicMetadata = user.publicMetadata ?? {};

    // Stamp signupPlatform on first mobile session. This fires on every app
    // launch after Clerk auth, so it covers 100% of app users; even those who
    // never listen and have no push token; feeding the acquisition funnel a
    // reliable platform instead of inferring it later.
    //
    // El valor sale de la cabecera del cliente, no de una constante: hasta
    // ahora se escribía "ios" para todo el mundo y quien entraba desde un
    // Android quedaba sellado como usuario de iPhone. Por eso el sello móvil
    // también se CORRIGE: si la cuenta ya dice "ios" y la app dice que es
    // Android, gana la app, que es la única que sabe en qué teléfono corre.
    // Un sello "web" no se toca: dice dónde nació la cuenta, y eso no cambia
    // porque después se instale la app.
    // Best-effort: a stamping failure must never block the session.
    const mobilePlatform = mobilePlatformFromRequest(req);
    const stamped = typeof publicMetadata.signupPlatform === "string" ? publicMetadata.signupPlatform : "";
    const isMobileStamp = stamped === "ios" || stamped === "android";
    if (!stamped || (isMobileStamp && stamped !== mobilePlatform)) {
      try {
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: { ...publicMetadata, signupPlatform: mobilePlatform },
        });
      } catch (stampErr) {
        console.error(`Failed to stamp signupPlatform=${mobilePlatform}:`, stampErr);
      }
    }

    const token = createMobileSessionToken({
      userId,
      email: user.primaryEmailAddress?.emailAddress ?? null,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null,
      plan: typeof publicMetadata.plan === "string" ? publicMetadata.plan : null,
      targetLanguages: isStringArray(publicMetadata.targetLanguages)
        ? publicMetadata.targetLanguages
        : [],
      booksCount: savedBooksCount,
      storiesCount: savedStoriesCount,
    });

    // Beta testers: stamp that they opened the app. This is the coarse signal
    // (a session is minted on launch, not on every tap); the Studio panel
    // derives real usage from UserMetric. Wrapped so a beta bookkeeping
    // failure can never cost someone their session.
    //
    // The email is passed so this also repairs the Clerk link when the
    // `user.created` webhook never fired. See reconcileBetaTesterLink.
    void touchTesterActivity(
      userId,
      user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null,
    ).catch((err) => {
      console.error("touchTesterActivity failed:", err);
    });

    return NextResponse.json({
      token,
      user: {
        id: userId,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null,
      },
    });
  } catch (error) {
    console.error("POST /api/mobile/session failed", error);
    return NextResponse.json(
      { error: "We could not create a mobile session from the Clerk session." },
      { status: 401 }
    );
  }
}
