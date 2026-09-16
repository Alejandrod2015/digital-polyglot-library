import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
async function main() {
  for (const [jid, topic] of [['cmqrtaj1p000032qtda86z6um','community-celebrations'],['cmtmylg7k0007321h6t7njesx','faith-and-devotion']] as const) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: jid, topic }, select: { title: true, vocab: true } })
    console.log(`\n## ${topic} (${ss.length} historias)`)
    ss.forEach(s => console.log(`  - ${s.title}`))
    const ws = ss.flatMap(s => (s.vocab as any[] ?? []).map(v => String(v.word)))
    console.log(`  VOCAB (${ws.length}): ${ws.join(', ')}`)
  }
}
main().finally(()=>p.$disconnect())
