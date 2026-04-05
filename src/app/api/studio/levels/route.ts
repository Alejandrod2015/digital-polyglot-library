import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

/** GET — list levels */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const levels = await prisma.level.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(levels);
}

/** POST — create level. Body: { code, label } */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.code?.trim() || !body?.label?.trim())
    return NextResponse.json({ error: "code and label required" }, { status: 400 });

  const max = await prisma.level.aggregate({ _max: { sortOrder: true } });
  const level = await prisma.level.create({
    data: { code: body.code.trim().toLowerCase(), label: body.label.trim(), sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(level);
}

/** PATCH — update level. Body: { id, label? } */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data: any = {};
  if (body.label) data.label = body.label.trim();
  const level = await prisma.level.update({ where: { id: body.id }, data });
  return NextResponse.json(level);
}

/** DELETE — delete level. Body: { id } */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.level.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}
