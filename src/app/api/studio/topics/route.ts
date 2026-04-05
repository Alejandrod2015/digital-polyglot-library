import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStudioMember, hasPermission, isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

function toSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** GET /api/studio/topics — list all topics */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const topics = await prisma.topic.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(topics);
}

/** POST /api/studio/topics — create a topic. Body: { label } */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const member = await getStudioMember(email);
  if (!member || !hasPermission(member.role, "*"))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { label } = body;
  if (!label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });

  const slug = toSlug(label);
  const maxOrder = await prisma.topic.aggregate({ _max: { sortOrder: true } });
  const topic = await prisma.topic.create({
    data: { slug, label: label.trim(), sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(topic);
}

/** PATCH /api/studio/topics — update a topic. Body: { id, label?, sortOrder? } */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const member = await getStudioMember(email);
  if (!member || !hasPermission(member.role, "*"))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, label, sortOrder } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, any> = {};
  if (label !== undefined) { data.label = label.trim(); data.slug = toSlug(label); }
  if (sortOrder !== undefined) data.sortOrder = sortOrder;

  const topic = await prisma.topic.update({ where: { id }, data });
  return NextResponse.json(topic);
}

/** DELETE /api/studio/topics — delete a topic. Body: { id } */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const member = await getStudioMember(email);
  if (!member || !hasPermission(member.role, "*"))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.topic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
