import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStudioMember, hasPermission, isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

function toSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** GET /api/studio/topics; list topics. Optional ?journeyType=slug to get universal + that journey's specialized */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const journeyTypeSlug = searchParams.get("journeyType");

  if (journeyTypeSlug) {
    // Return universal topics + specialized topics assigned to this journey type
    const jt = await prisma.journeyType.findUnique({ where: { slug: journeyTypeSlug } });
    if (!jt) return NextResponse.json({ error: "Journey type not found" }, { status: 404 });

    const [universal, specialized] = await Promise.all([
      prisma.topic.findMany({ where: { isUniversal: true }, orderBy: { sortOrder: "asc" } }),
      prisma.topicJourneyType.findMany({
        where: { journeyTypeId: jt.id },
        include: { topic: true },
        orderBy: { topic: { sortOrder: "asc" } },
      }),
    ]);

    const specializedTopics = specialized.map((s) => s.topic);
    const all = [...universal, ...specializedTopics].sort((a, b) => a.sortOrder - b.sortOrder);
    return NextResponse.json(all);
  }

  // No filter: return all topics with isUniversal and journeyTypes info
  const topics = await prisma.topic.findMany({
    orderBy: { sortOrder: "asc" },
    include: { journeyTypes: { include: { journeyType: true } } },
  });
  return NextResponse.json(topics.map((t) => ({
    ...t,
    journeyTypes: t.journeyTypes.map((jt) => ({ slug: jt.journeyType.slug, label: jt.journeyType.label })),
  })));
}

/** POST /api/studio/topics; create a topic. Body: { label } */
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

/** PATCH /api/studio/topics; update a topic. Body: { id, label?, sortOrder? } */
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

  const { id, label, sortOrder, defaultLevel } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, any> = {};
  if (label !== undefined) { data.label = label.trim(); data.slug = toSlug(label); }
  if (sortOrder !== undefined) data.sortOrder = sortOrder;
  if (defaultLevel !== undefined) data.defaultLevel = defaultLevel;

  const topic = await prisma.topic.update({ where: { id }, data });
  return NextResponse.json(topic);
}

/** DELETE /api/studio/topics; delete a topic. Body: { id } */
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
