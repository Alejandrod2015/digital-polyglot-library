import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
const j = await prisma.journey.findUnique({
  where: { id: 'cmu0dqr6y0007j8o52i1s3gf7' },
  include: { stories: { select: { id: true, slug: true, status: true, coverUrl: true, audioUrl: true } } }
});
if (!j) { console.log('JOURNEY NOT FOUND'); process.exit(1); }
console.log('status:', j.status, 'topics:', JSON.stringify(j.topics)?.slice(0,200), 'levels:', JSON.stringify(j.levels)?.slice(0,200));
console.log('total stories:', j.stories.length);
const missingCover = j.stories.filter(s => !s.coverUrl);
const missingAudio = j.stories.filter(s => !s.audioUrl);
console.log('missing cover:', missingCover.map(s => s.slug));
console.log('missing audio:', missingAudio.map(s => s.slug));
console.log('statuses:', [...new Set(j.stories.map(s=>s.status))]);
await prisma.$disconnect();
