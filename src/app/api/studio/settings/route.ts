import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStudioMember, hasPermission } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "studio_settings";

type StudioSettings = {
  testMode: boolean;
  sectionAccess: Record<string, { manager: boolean; creator: boolean }>;
};

const DEFAULT_SETTINGS: StudioSettings = {
  testMode: false,
  sectionAccess: {
    "Journey Manager": { manager: true, creator: true },
    "Biblioteca": { manager: true, creator: true },
    "Reglas pedagógicas": { manager: true, creator: false },
  },
};

/**
 * GET /api/studio/settings
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const member = await getStudioMember(email);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only admins can see settings
  if (!hasPermission(member.role, "*"))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const row = await prisma.studioConfig.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = row ? { ...DEFAULT_SETTINGS, ...(row.value as object) } : DEFAULT_SETTINGS;
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

/**
 * POST /api/studio/settings
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const member = await getStudioMember(email);
  if (!member || !hasPermission(member.role, "*"))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: Partial<StudioSettings>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Merge with existing
  let existing: StudioSettings = DEFAULT_SETTINGS;
  try {
    const row = await prisma.studioConfig.findUnique({ where: { key: SETTINGS_KEY } });
    if (row) existing = { ...DEFAULT_SETTINGS, ...(row.value as object) };
  } catch { /* use default */ }

  const updated: StudioSettings = {
    testMode: body.testMode ?? existing.testMode,
    sectionAccess: body.sectionAccess ?? existing.sectionAccess,
  };

  await prisma.studioConfig.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: updated as any, updatedBy: email },
    update: { value: updated as any, updatedBy: email },
  });

  return NextResponse.json(updated);
}
