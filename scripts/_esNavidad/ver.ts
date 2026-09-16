import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
p.journey.findUnique({ where: { id: 'cmtmylg7k0007321h6t7njesx' } }).then(j => {
  console.log(JSON.stringify(j, null, 2))
}).then(async () => {
  const t = await p.topic.findFirst({ where: { slug: 'faith-and-devotion' }, include: { journeyTypes: true } })
  console.log('TOPIC:', JSON.stringify(t, null, 2))
  const s = await p.journeyStory.findFirst({ where: { journeyId: 'cmtmylg7k0007321h6t7njesx' }, select: { level: true, topic: true, slotIndex: true, status: true } })
  console.log('STORY:', JSON.stringify(s))
}).finally(()=>p.$disconnect())
