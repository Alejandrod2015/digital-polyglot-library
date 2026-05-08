import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { syncCreateStoryMirror } from '@/lib/createStoryMirror';
import { getPublicUserStories, getUserStoryById } from '@/lib/userStories';
import { getMobileSessionFromRequest } from '@/lib/mobileSession';
import { prisma } from '@/lib/prisma';
import { getStandaloneStoriesBySlugs } from '@/lib/standaloneStories';
import { getStandaloneStoryAudioSegments } from '@/lib/standaloneStoryAudioSegments';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('id');
    const slugsParam = searchParams.get('slugs');
    const mine = searchParams.get('mine') === '1';
    const latestForCreate = searchParams.get('latestForCreate') === '1';
    const limitRaw = searchParams.get('limit');
    const limit =
      typeof limitRaw === 'string' && Number.isFinite(Number(limitRaw))
        ? Math.min(Math.max(Number(limitRaw), 1), 24)
        : 8;

    if (slugsParam) {
      const { userId } = await auth();
      const mobileSession = getMobileSessionFromRequest(req);
      const effectiveUserId = userId ?? mobileSession?.sub ?? null;
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

      // Algunos favoritos legacy guardan `storySlug` con el formato
      // `journey-{cuid}` (el cuid es el JourneyStory.id interno) en
      // lugar del slug real. Sin esta resolución el endpoint nunca
      // matchea esas filas y mobile no encuentra el audio. Extraemos
      // los IDs así matcheamos por id O por slug, retornando los
      // resultados con el slug pseudo-slug original para que el
      // lookup del cliente (que usa el mismo `journey-{id}` como key)
      // siga funcionando.
      const journeyIdsFromPseudoSlugs = new Map<string, string>();
      for (const slug of slugs) {
        const match = slug.match(/^journey-([a-z0-9]{20,})$/i);
        if (match && match[1]) journeyIdsFromPseudoSlugs.set(match[1], slug);
      }
      const pseudoIds = Array.from(journeyIdsFromPseudoSlugs.keys());

      const [userStories, journeyStoriesBySlug, journeyStoriesById] = await Promise.all([
        prisma.userStory.findMany({
          where: {
            slug: { in: slugs },
            ...(effectiveUserId ? { OR: [{ public: true }, { userId: effectiveUserId }] } : { public: true }),
          },
          select: {
            slug: true,
            audioUrl: true,
            audioSegments: true,
          },
        }),
        // También consultamos JourneyStory porque las historias del
        // Studio Journey (p.ej. los diálogos alemanes A1) viven ahí
        // y no en UserStory. Sin esto, el botón "Story" del práctico
        // móvil queda mudo para esas historias porque no encuentra
        // audio metadata. Filtramos por status published para evitar
        // exponer drafts.
        prisma.journeyStory.findMany({
          where: {
            slug: { in: slugs },
            status: "published",
            audioUrl: { not: null },
          },
          select: {
            slug: true,
            audioUrl: true,
            audioSegments: true,
          },
        }),
        pseudoIds.length > 0
          ? prisma.journeyStory.findMany({
              where: {
                id: { in: pseudoIds },
                status: "published",
                audioUrl: { not: null },
              },
              select: {
                id: true,
                slug: true,
                audioUrl: true,
                audioSegments: true,
              },
            })
          : Promise.resolve([] as Array<{ id: string; slug: string | null; audioUrl: string | null; audioSegments: unknown }>),
      ]);

      // Para los matches por ID, sustituimos el slug retornado por el
      // pseudo-slug original que el cliente envió, así su lookup en
      // `userStoryAudioBySlug[slug]` encuentra la entrada.
      const journeyStories = [
        ...journeyStoriesBySlug,
        ...journeyStoriesById.map((s) => ({
          slug: journeyIdsFromPseudoSlugs.get(s.id) ?? s.slug,
          audioUrl: s.audioUrl,
          audioSegments: s.audioSegments,
        })),
      ];

      // De-dup por slug: si ambos modelos tienen la misma slug, gana
      // UserStory (la fuente más antigua y específica del usuario).
      const seen = new Set<string>();
      const merged: Array<{ slug: string | null; audioUrl: string | null; audioSegments: unknown }> = [];
      for (const story of userStories) {
        if (story.slug && !seen.has(story.slug)) {
          seen.add(story.slug);
          merged.push(story);
        }
      }
      for (const story of journeyStories) {
        if (story.slug && !seen.has(story.slug)) {
          seen.add(story.slug);
          merged.push(story);
        }
      }

      // Para los slugs que no matchean ni UserStory ni JourneyStory,
      // probamos Sanity (standalone stories de los libros tipo
      // "colloquial-german-stories"). Estas viven en CMS, no en DB.
      // Incluimos solo las que tienen audioUrl publicado; los segments
      // alineados solo existen para las que están en el registry
      // hardcoded (`standaloneStoryAudioSegments`), para las demás
      // devolvemos `[]` y el cliente reproduce desde el inicio del MP3
      // (mejor que botón disabled silencioso).
      const unmatched = slugs.filter((s) => !seen.has(s));
      if (unmatched.length > 0) {
        try {
          const sanityStories = await getStandaloneStoriesBySlugs(unmatched);
          for (const story of sanityStories) {
            if (!story.slug || seen.has(story.slug)) continue;
            const audioUrl = story.audioUrl;
            if (typeof audioUrl !== "string" || !audioUrl.trim()) continue;
            const segments = getStandaloneStoryAudioSegments(story.slug);
            seen.add(story.slug);
            merged.push({ slug: story.slug, audioUrl, audioSegments: segments });
          }
        } catch (err) {
          console.error("[user-stories] Sanity standalone fallback failed:", err);
        }
      }

      await prisma.$disconnect();
      return NextResponse.json({ stories: merged });
    }

    // 🔹 Si viene un id → devolver solo esa historia
    if (storyId) {
      const story = await getUserStoryById(storyId);
      await prisma.$disconnect();

      if (!story) {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 });
      }

      return NextResponse.json({ story });
    }

    if (mine && latestForCreate) {
      const { userId } = await auth();
      const mobileSession = getMobileSessionFromRequest(req);
      const effectiveUserId = userId ?? mobileSession?.sub ?? null;
      if (!effectiveUserId) {
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
          userId: effectiveUserId,
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

      const canonicalStory = story ? await getUserStoryById(story.id) : null;
      await prisma.$disconnect();
      return NextResponse.json({ story: canonicalStory ?? null });
    }

    if (mine) {
      const { userId } = await auth();
      const mobileSession = getMobileSessionFromRequest(req);
      const effectiveUserId = userId ?? mobileSession?.sub ?? null;
      if (!effectiveUserId) {
        await prisma.$disconnect();
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const stories = await prisma.userStory.findMany({
        where: {
          userId: effectiveUserId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          text: true,
          vocab: true,
          language: true,
          variant: true,
          region: true,
          level: true,
          cefrLevel: true,
          focus: true,
          topic: true,
          public: true,
          coverUrl: true,
          coverFilename: true,
          audioUrl: true,
          audioSegments: true,
          audioFilename: true,
          audioStatus: true,
          createdAt: true,
        },
      });

      await prisma.$disconnect();
      return NextResponse.json({ stories });
    }

    // 🔹 Si no hay id → devolver lista general
    const stories = await getPublicUserStories();
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

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const storyId = typeof body?.id === 'string' ? body.id.trim() : '';

    if (!storyId) {
      await prisma.$disconnect();
      return NextResponse.json({ error: 'Story id is required' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    const textFields = [
      'title',
      'text',
      'language',
      'variant',
      'region',
      'level',
      'cefrLevel',
      'focus',
      'topic',
    ] as const;

    for (const field of textFields) {
      const value = body?.[field];
      if (typeof value === 'string') {
        data[field] = value.trim();
      }
    }

    if (typeof body?.public === 'boolean') {
      data.public = body.public;
    }

    if (Array.isArray(body?.vocab)) {
      data.vocab = body.vocab;
    }

    const updated = await prisma.userStory.update({
      where: { id: storyId },
      data,
      select: {
        id: true,
        userId: true,
        title: true,
        slug: true,
        text: true,
        vocab: true,
        language: true,
        variant: true,
        region: true,
        level: true,
        cefrLevel: true,
        focus: true,
        topic: true,
        public: true,
        coverUrl: true,
        coverFilename: true,
        audioUrl: true,
        audioSegments: true,
        audioFilename: true,
        audioStatus: true,
        createdAt: true,
      },
    });

    try {
      await syncCreateStoryMirror(updated);
    } catch (mirrorError) {
      console.warn('[create-story-mirror] Update sync failed:', mirrorError);
    }

    await prisma.$disconnect();
    return NextResponse.json({ story: updated });
  } catch (error) {
    console.error('Error updating user story:', error);
    await prisma.$disconnect();
    return NextResponse.json(
      { error: 'Failed to update story' },
      { status: 500 },
    );
  }
}
