import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStudioMember, hasPermission, isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

function toSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** GET /api/studio/journey-types — list all journey types */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const types = await prisma.journeyType.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(types);
}

/** POST /api/studio/journey-types — create a journey type. Body: { label } */
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
  const maxOrder = await prisma.journeyType.aggregate({ _max: { sortOrder: true } });
  const journeyType = await prisma.journeyType.create({
    data: { slug, label: label.trim(), sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(journeyType);
}

/** PATCH /api/studio/journey-types — update a journey type. Body: { id, label?, sortOrder? } */
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

  const { id, label, sortOrder, assignTopicId, unassignTopicId, addTopicLabel } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Assign an existing specialized topic to this journey type
  if (assignTopicId) {
    await prisma.topicJourneyType.upsert({
      where: { topicId_journeyTypeId: { topicId: assignTopicId, journeyTypeId: id } },
      update: {},
      create: { topicId: assignTopicId, journeyTypeId: id },
    });
    return NextResponse.json({ ok: true });
  }

  // Unassign a topic from this journey type
  if (unassignTopicId) {
    await prisma.topicJourneyType.deleteMany({
      where: { topicId: unassignTopicId, journeyTypeId: id },
    });
    return NextResponse.json({ ok: true });
  }

  // Create a new specialized topic and assign it to this journey type
  if (addTopicLabel) {
    const slug = toSlug(addTopicLabel);
    const maxOrder = await prisma.topic.aggregate({ _max: { sortOrder: true } });
    const topic = await prisma.topic.upsert({
      where: { slug },
      update: {},
      create: { slug, label: addTopicLabel.trim(), isUniversal: false, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
    });
    await prisma.topicJourneyType.upsert({
      where: { topicId_journeyTypeId: { topicId: topic.id, journeyTypeId: id } },
      update: {},
      create: { topicId: topic.id, journeyTypeId: id },
    });
    return NextResponse.json({ ok: true, topic });
  }

  const data: Record<string, any> = {};
  if (label !== undefined) { data.label = label.trim(); data.slug = toSlug(label); }
  if (sortOrder !== undefined) data.sortOrder = sortOrder;

  const journeyType = await prisma.journeyType.update({ where: { id }, data });
  return NextResponse.json(journeyType);
}

/** DELETE /api/studio/journey-types — delete a journey type. Body: { id } */
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

  await prisma.journeyType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
