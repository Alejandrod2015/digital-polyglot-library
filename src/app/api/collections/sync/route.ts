import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type IncomingCollection = {
  id: string;
  name: string;
  language?: string | null;
  wordKeys: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Bulk sync endpoint used by mobile's one-time migration from local
 * FileSystem to the backend.
 *
 * Semantics (designed to make the migration zero-risk):
 *  - For each incoming collection: upsert by id, scoped to the
 *    current Clerk userId.
 *  - On conflict, MERGE wordKeys (set union); never drop entries.
 *    The remote may already have keys the local didn't, e.g. because
 *    the user added items from web; we keep both sides.
 *  - Name conflict: keep the local name. Migrations are user-initiated;
 *    the local copy is the authoritative source of recent edits.
 *  - The endpoint is IDEMPOTENT: running it twice with the same input
 *    yields the same final state.
 *
 * Body: { collections: IncomingCollection[] }
 * Returns: { collections: <full merged list for the user> }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const incoming = ((body as { collections?: unknown })?.collections ?? []) as unknown[];
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: "collections_required" }, { status: 400 });
  }

  // Normalize + sanitize each incoming entry. Drop malformed ones
  // silently; the migration runs unattended on the device, we'd
  // rather succeed with the well-formed subset than fail completely.
  const sanitized: IncomingCollection[] = [];
  for (const raw of incoming) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id.trim()) continue;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    const wordKeys = Array.isArray(o.wordKeys)
      ? Array.from(
          new Set(
            (o.wordKeys as unknown[])
              .filter((k): k is string => typeof k === "string" && k.length > 0),
          ),
        )
      : [];
    sanitized.push({
      id: o.id.trim(),
      name: o.name.trim().slice(0, 80),
      language: typeof o.language === "string" && o.language.trim() ? o.language.trim() : null,
      wordKeys,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : null,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
    });
  }

  // Pre-fetch existing rows for the user so we can compute the
  // wordKeys merge without an extra round-trip per item.
  const existingRows = await prisma.favoriteCollection.findMany({
    where: { userId, id: { in: sanitized.map((c) => c.id) } },
  });
  const existingById = new Map(existingRows.map((r) => [r.id, r] as const));

  for (const c of sanitized) {
    const existing = existingById.get(c.id);
    const mergedKeys = existing
      ? Array.from(new Set([...existing.wordKeys, ...c.wordKeys]))
      : c.wordKeys;

    if (existing) {
      await prisma.favoriteCollection.update({
        where: { id: c.id },
        data: {
          name: c.name,
          language: c.language ?? existing.language,
          wordKeys: mergedKeys,
        },
      });
    } else {
      await prisma.favoriteCollection.create({
        data: {
          id: c.id,
          userId,
          name: c.name,
          language: c.language,
          wordKeys: mergedKeys,
          ...(c.createdAt ? { createdAt: new Date(c.createdAt) } : {}),
        },
      });
    }
  }

  const all = await prisma.favoriteCollection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ collections: all });
}
