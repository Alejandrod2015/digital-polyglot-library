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
const MAX_INTERESTS = 12;
const ALLOWED_REGIONS = new Set([
  "Colombia",
  "Mexico",
  "Argentina",
  "Peru",
  "Germany",
  "France",
  "Brazil",
  "Portugal",
  "Italy",
  "Spain",
]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function normalizeInterests(interests: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of interests) {
    const cleaned = raw.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
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

function normalizeLevel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (key === "beginner") return "Beginner";
  if (key === "intermediate") return "Intermediate";
  if (key === "advanced") return "Advanced";
  return null;
}

function normalizeRegion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const aliases: Record<string, string> = {
    colombia: "Colombia",
    mexico: "Mexico",
    argentina: "Argentina",
    peru: "Peru",
    germany: "Germany",
    france: "France",
    brazil: "Brazil",
    brasil: "Brazil",
    portugal: "Portugal",
    italy: "Italy",
    spain: "Spain",
  };
  const normalized = aliases[value.trim().toLowerCase()];
  return normalized && ALLOWED_REGIONS.has(normalized) ? normalized : null;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const hasTargetLanguages = Object.prototype.hasOwnProperty.call(body ?? {}, "targetLanguages");
    const hasInterests = Object.prototype.hasOwnProperty.call(body ?? {}, "interests");
    const hasPreferredLevel = Object.prototype.hasOwnProperty.call(body ?? {}, "preferredLevel");
    const hasPreferredRegion = Object.prototype.hasOwnProperty.call(body ?? {}, "preferredRegion");
    const targetLanguages = body?.targetLanguages;
    const interests = body?.interests;
    const preferredLevel = body?.preferredLevel;
    const preferredRegion = body?.preferredRegion;

    if (hasTargetLanguages && !isStringArray(targetLanguages)) {
      return NextResponse.json(
        { error: "Invalid targetLanguages: expected string[]" },
        { status: 400 }
      );
    }
    if (hasInterests && !isStringArray(interests)) {
      return NextResponse.json(
        { error: "Invalid interests: expected string[]" },
        { status: 400 }
      );
    }
    if (hasPreferredLevel && preferredLevel !== null && typeof preferredLevel !== "string") {
      return NextResponse.json({ error: "Invalid preferredLevel: expected string|null" }, { status: 400 });
    }
    if (hasPreferredRegion && preferredRegion !== null && typeof preferredRegion !== "string") {
      return NextResponse.json({ error: "Invalid preferredRegion: expected string|null" }, { status: 400 });
    }

    // 1) Leer metadatos actuales
    const user = await clerkClient.users.getUser(userId);
    const existing =
      (user.publicMetadata as Record<string, unknown>) ?? {};
    const existingTargetLanguages = isStringArray(existing.targetLanguages)
      ? normalize(existing.targetLanguages)
      : [];
    const existingInterests = isStringArray(existing.interests)
      ? normalizeInterests(existing.interests)
      : [];

    const normalizedTargetLanguages = hasTargetLanguages
      ? normalize(targetLanguages)
      : existingTargetLanguages;
    const normalizedInterests = hasInterests
      ? normalizeInterests(interests)
      : existingInterests;
    const normalizedPreferredLevel = hasPreferredLevel
      ? normalizeLevel(preferredLevel)
      : typeof existing.preferredLevel === "string"
        ? normalizeLevel(existing.preferredLevel)
        : null;
    const normalizedPreferredRegion = hasPreferredRegion
      ? normalizeRegion(preferredRegion)
      : typeof existing.preferredRegion === "string"
        ? normalizeRegion(existing.preferredRegion)
        : null;

    const updatedMetadata: Record<string, unknown> = {
      ...existing,
      targetLanguages: normalizedTargetLanguages,
      interests: normalizedInterests,
    };

    if (normalizedPreferredLevel) {
      updatedMetadata.preferredLevel = normalizedPreferredLevel;
    } else {
      delete updatedMetadata.preferredLevel;
    }

    if (normalizedPreferredRegion) {
      updatedMetadata.preferredRegion = normalizedPreferredRegion;
    } else {
      delete updatedMetadata.preferredRegion;
    }

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
    const finalInterests = Array.isArray(finalMeta.interests)
      ? finalMeta.interests.filter((x): x is string => typeof x === "string")
      : [];
    const finalPreferredLevel =
      typeof finalMeta.preferredLevel === "string" ? finalMeta.preferredLevel : null;
    const finalPreferredRegion =
      typeof finalMeta.preferredRegion === "string" ? finalMeta.preferredRegion : null;

    return new NextResponse(
      JSON.stringify({
        targetLanguages: finalTL,
        interests: finalInterests,
        preferredLevel: finalPreferredLevel,
        preferredRegion: finalPreferredRegion,
      }),
      {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      }
    );
  } catch (error: unknown) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
