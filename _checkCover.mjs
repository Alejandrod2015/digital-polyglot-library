import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
const s = await prisma.journeyStory.findFirst({
  where: { journeyId: 'cmu0dqr6y0007j8o52i1s3gf7', slug: 'die-jacke-aus-rostock' },
  select: { id: true, slug: true, coverUrl: true, status: true, updatedAt: true }
});
console.log(JSON.stringify(s, null, 2));
await prisma.$disconnect();
