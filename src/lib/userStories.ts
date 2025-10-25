import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export type PublicUserStory = {
  id: string;
  slug: string;
  title: string;
  language: string | null;
  level: string | null;
  region: string | null;
  text: string | null;
  audioUrl: string | null;
  createdAt: Date;
};

export async function getPublicUserStories(): Promise<PublicUserStory[]> {
  const stories = await prisma.userStory.findMany({
    where: { public: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      language: true,
      level: true,
      region: true,
      text: true,
      audioUrl: true,
      createdAt: true,
    },
  });

  // Prisma ya retorna tipos correctos; devolvemos tal cual.
  return stories;
}

export async function getUserStoryById(id: string): Promise<PublicUserStory | null> {
  const story = await prisma.userStory.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      language: true,
      level: true,
      region: true,
      text: true,
      audioUrl: true,
      createdAt: true,
    },
  });
  return story;
}
