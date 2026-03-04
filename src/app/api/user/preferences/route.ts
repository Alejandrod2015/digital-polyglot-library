// /src/app/api/user/preferences/route.ts
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { NextResponse } from "next/server";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const ALLOWED_LANGUAGES = new Set([
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Korean",
  "Chinese",
]);
const MAX_SELECTION = 3;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function normalize(langs: string[]): string[] {
  const aliases: Record<string, string> = {
    english: "English",
    spanish: "Spanish",
    french: "French",
    german: "German",
    italian: "Italian",
    portuguese: "Portuguese",
    japanese: "Japanese",
    korean: "Korean",
    chinese: "Chinese",
  };

  const seen = new Set<string>();
  for (const raw of langs) {
    const key = raw.trim().toLowerCase();
    const canonical = aliases[key];
    if (!canonical) continue;
    if (!ALLOWED_LANGUAGES.has(canonical)) continue;
    seen.add(canonical);
    if (seen.size >= MAX_SELECTION) break;
  }
  return Array.from(seen);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const targetLanguages = body?.targetLanguages;
    if (!isStringArray(targetLanguages)) {
      return NextResponse.json(
        { error: "Invalid targetLanguages: expected string[]" },
        { status: 400 }
      );
    }

    const normalized = normalize(targetLanguages);

    // 1) Leer metadatos actuales
    const user = await clerkClient.users.getUser(userId);
    const existing =
      (user.publicMetadata as Record<string, unknown>) ?? {};
    const plan = (existing.plan as string | undefined) ?? "free";
    if (plan === "free") {
      return NextResponse.json(
        { error: "Upgrade required to update language preferences" },
        { status: 403 }
      );
    }

    // 2) Escribir: fusionar pero sobrescribir targetLanguages con normalized
    const updatedMetadata = {
      ...existing,
      targetLanguages: normalized,
    };

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: updatedMetadata,
    });

    // 3) Confirmar estado final desde Clerk (lectura posterior al update)
    const after = await clerkClient.users.getUser(userId);
    const finalMeta =
      (after.publicMetadata as Record<string, unknown>) ?? {};
    const finalTL = Array.isArray(finalMeta.targetLanguages)
      ? finalMeta.targetLanguages.filter((x): x is string => typeof x === "string")
      : [];

    return new NextResponse(JSON.stringify({ targetLanguages: finalTL }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
