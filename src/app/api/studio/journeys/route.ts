import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/studio/journeys — list all journeys with story counts
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const journeys = await prisma.journey.findMany({
    where: { status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
    include: {
      stories: {
        select: { id: true, status: true, coverDone: true },
      },
    },
  });

  const result = journeys.map((j) => {
    const total = j.stories.length;
    const generated = j.stories.filter((s) => ["generated", "qa_pass", "approved", "published"].includes(s.status)).length;
    const published = j.stories.filter((s) => s.status === "published").length;
    const withCover = j.stories.filter((s) => s.coverDone).length;
    return {
      id: j.id,
      name: j.name,
      language: j.language,
      variant: j.variant,
      levels: j.levels,
      topics: j.topics,
      storiesPerTopic: j.storiesPerTopic,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
      stats: { total, generated, published, withCover },
    };
  });

  return NextResponse.json(result);
}

/**
 * POST /api/studio/journeys — create a new journey with story slots
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { name, language, variant, levels, topics, topicsByLevel, storiesPerTopic } = body;
  if (!name || !language || !variant || !levels?.length)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const spt = Math.max(1, Math.min(10, storiesPerTopic || 1));

  // Build story slots — use topicsByLevel if available, otherwise fall back to flat topics
  const storySlots: Array<{ level: string; topic: string; slotIndex: number; status: "draft" }> = [];
  for (const level of levels as string[]) {
    const levelTopics: string[] = topicsByLevel?.[level] ?? topics ?? [];
    for (const topic of levelTopics) {
      for (let i = 0; i < spt; i++) {
        storySlots.push({ level, topic, slotIndex: i, status: "draft" });
      }
    }
  }

  // Collect all unique topics for the journey record
  const allTopics = [...new Set(storySlots.map((s) => s.topic))];

  const journey = await prisma.journey.create({
    data: {
      name,
      language,
      variant,
      levels,
      topics: allTopics,
      storiesPerTopic: spt,
      createdBy: email,
      stories: {
        create: storySlots,
      },
    },
    include: { stories: true },
  });

  return NextResponse.json({
    id: journey.id,
    name: journey.name,
    totalStories: journey.stories.length,
  });
}

/**
 * DELETE /api/studio/journeys — delete a journey and all its stories
 * Body: { journeyId }
 */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { journeyId } = body;
  if (!journeyId) return NextResponse.json({ error: "journeyId required" }, { status: 400 });

  // Cascade delete handles stories
  await prisma.journey.delete({ where: { id: journeyId } });
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/studio/journeys — update journey name, add/remove levels
 * Body: { journeyId, name?, addLevels?, removeLevels? }
 */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { journeyId, name, addLevels, removeLevels, journeyTypeSlug } = body;
  if (!journeyId) return NextResponse.json({ error: "journeyId required" }, { status: 400 });

  const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
  if (!journey) return NextResponse.json({ error: "Journey not found" }, { status: 404 });

  // Rename
  if (name) {
    await prisma.journey.update({ where: { id: journeyId }, data: { name } });
  }

  // Add levels: create story slots using topics whose defaultLevel matches
  if (Array.isArray(addLevels) && addLevels.length > 0) {
    const newLevels = addLevels.filter((l: string) => !journey.levels.includes(l));
    if (newLevels.length > 0) {
      // Get all topics available for this journey type (universal + specialized)
      let availableTopicSlugs: string[];
      if (journeyTypeSlug) {
        const jt = await prisma.journeyType.findUnique({ where: { slug: journeyTypeSlug } });
        const [universal, specialized] = await Promise.all([
          prisma.topic.findMany({ where: { isUniversal: true }, select: { slug: true } }),
          jt ? prisma.topicJourneyType.findMany({ where: { journeyTypeId: jt.id }, include: { topic: { select: { slug: true } } } }) : Promise.resolve([]),
        ]);
        availableTopicSlugs = [...universal.map((t) => t.slug), ...specialized.map((s) => s.topic.slug)];
      } else {
        availableTopicSlugs = journey.topics;
      }

      const topicsForLevels = await prisma.topic.findMany({
        where: { slug: { in: availableTopicSlugs }, defaultLevel: { in: newLevels } },
      });

      const storyData: { journeyId: string; level: string; topic: string; slotIndex: number }[] = [];
      for (const topic of topicsForLevels) {
        const level = topic.defaultLevel!;
        for (let i = 0; i < journey.storiesPerTopic; i++) {
          storyData.push({ journeyId, level, topic: topic.slug, slotIndex: i });
        }
      }

      // Update the journey topics array to include any new topic slugs
      const allTopicSlugs = new Set([...journey.topics, ...topicsForLevels.map((t) => t.slug)]);

      await prisma.$transaction([
        ...(storyData.length > 0 ? [prisma.journeyStory.createMany({ data: storyData, skipDuplicates: true })] : []),
        prisma.journey.update({ where: { id: journeyId }, data: { levels: [...journey.levels, ...newLevels], topics: [...allTopicSlugs] } }),
      ]);
      return NextResponse.json({ ok: true, addedLevels: newLevels, storiesCreated: storyData.length });
    }
  }

  // Remove levels: delete stories and update journey
  if (Array.isArray(removeLevels) && removeLevels.length > 0) {
    const remaining = journey.levels.filter((l) => !removeLevels.includes(l));
    if (remaining.length === 0) {
      return NextResponse.json({ error: "Cannot remove all levels" }, { status: 400 });
    }
    const deletedCount = await prisma.journeyStory.count({ where: { journeyId, level: { in: removeLevels } } });
    await prisma.$transaction([
      prisma.journeyStory.deleteMany({ where: { journeyId, level: { in: removeLevels } } }),
      prisma.journey.update({ where: { id: journeyId }, data: { levels: remaining } }),
    ]);
    return NextResponse.json({ ok: true, removedLevels: removeLevels, storiesDeleted: deletedCount });
  }

  return NextResponse.json({ ok: true });
}
