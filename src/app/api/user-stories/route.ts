import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { auth } from '@clerk/nextjs/server';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('id');
    const slugsParam = searchParams.get('slugs');
    const mine = searchParams.get('mine') === '1';
    const latestForCreate = searchParams.get('latestForCreate') === '1';

    if (slugsParam) {
      const { userId } = await auth();
      const slugs = Array.from(
        new Set(
          slugsParam
            .split(',')
            .map((slug) => slug.trim())
            .filter(Boolean)
        )
      );

      if (slugs.length === 0) {
        await prisma.$disconnect();
        return NextResponse.json({ stories: [] });
      }

      const stories = await prisma.userStory.findMany({
        where: {
          slug: { in: slugs },
          ...(userId ? { OR: [{ public: true }, { userId }] } : { public: true }),
        },
        select: {
          slug: true,
          audioUrl: true,
          audioSegments: true,
        },
      });

      await prisma.$disconnect();
      return NextResponse.json({ stories });
    }

    // 🔹 Si viene un id → devolver solo esa historia
    if (storyId) {
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: {
          id: true,
          title: true,
          slug: true,
          text: true,
          language: true,
          variant: true,
          region: true,
          level: true,
          cefrLevel: true,
          focus: true,
          topic: true,
          audioUrl: true,
          audioSegments: true,
          audioFilename: true,
          audioStatus: true,
          createdAt: true,
        },
      });

      await prisma.$disconnect();

      if (!story) {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 });
      }

      return NextResponse.json({ story });
    }

    if (mine && latestForCreate) {
      const { userId } = await auth();
      if (!userId) {
        await prisma.$disconnect();
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const language = searchParams.get('language')?.trim();
      const variant = searchParams.get('variant')?.trim();
      const cefrLevel = searchParams.get('cefrLevel')?.trim();
      const level = searchParams.get('level')?.trim();
      const focus = searchParams.get('focus')?.trim();
      const topic = searchParams.get('topic')?.trim();
      const region = searchParams.get('region')?.trim();
      const sinceRaw = searchParams.get('since');

      const sinceDate =
        sinceRaw && !Number.isNaN(Number(sinceRaw))
          ? new Date(Number(sinceRaw))
          : null;

      const story = await prisma.userStory.findFirst({
        where: {
          userId,
          ...(language ? { language } : {}),
          ...(variant ? { variant } : {}),
          ...(cefrLevel ? { cefrLevel } : {}),
          ...(level ? { level } : {}),
          ...(focus ? { focus } : {}),
          ...(topic ? { topic } : {}),
          ...(region ? { region } : {}),
          ...(sinceDate && !Number.isNaN(sinceDate.getTime())
            ? { createdAt: { gte: sinceDate } }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          text: true,
          language: true,
          variant: true,
          region: true,
          level: true,
          cefrLevel: true,
          focus: true,
          topic: true,
          audioUrl: true,
          audioSegments: true,
          audioFilename: true,
          audioStatus: true,
          createdAt: true,
        },
      });

      await prisma.$disconnect();
      return NextResponse.json({ story: story ?? null });
    }

    // 🔹 Si no hay id → devolver lista general
    const stories = await prisma.userStory.findMany({
      where: { public: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        text: true, // ✅ se incluye texto
        language: true,
        variant: true,
        level: true,
        cefrLevel: true,
        region: true,
        audioUrl: true,
        audioSegments: true,
        audioStatus: true,
        createdAt: true,
      },
    });

    await prisma.$disconnect();

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Error fetching user stories:', error);
    await prisma.$disconnect();
    return NextResponse.json(
      { error: 'Failed to load stories' },
      { status: 500 },
    );
  }
}
