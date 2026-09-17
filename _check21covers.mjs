import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
const stories = await prisma.journeyStory.findMany({ where: { journeyId: 'cmu0dqr6y0007j8o52i1s3gf7' }, select: { slug: true, coverUrl: true } });
console.log('total:', stories.length);
console.log('sin cover:', stories.filter(s=>!s.coverUrl).map(s=>s.slug));
const urls = stories.map(s=>s.coverUrl);
console.log('urls unicas:', new Set(urls).size, 'de', urls.length);
await prisma.$disconnect();
