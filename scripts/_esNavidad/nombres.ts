import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
async function main() {
  const js = await p.journey.findMany({ where: { status: { in: ['active','draft'] } }, select: { id: true, name: true, language: true, variant: true, levels: true } })
  const names = new Set<string>()
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { cast: true } })
    for (const s of ss) { const c: any = s.cast; (c?.characters ?? []).forEach((ch: any) => ch?.name && names.add(String(ch.name).trim())) }
  }
  console.log('NOMBRES ocupados en live+draft (' + names.size + '):')
  console.log([...names].sort().join(', '))
}
main().finally(()=>p.$disconnect())
