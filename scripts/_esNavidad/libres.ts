import { PrismaClient } from '../../src/generated/prisma'
import { SPANISH_B1_LEMMAS } from '../../src/lib/cefr/spanishB1'
const p = new PrismaClient()
async function main() {
  const js = await p.journey.findMany({ where: { language: 'spanish', status: { in: ['active','draft'] } }, select: { id: true } })
  const taken = new Set<string>()
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } })
    for (const s of ss) for (const v of (s.vocab as any[] ?? [])) {
      const w = String(v?.word ?? '').toLowerCase().trim(); if (w) taken.add(w)
    }
  }
  const libres = [...SPANISH_B1_LEMMAS].filter(w => !taken.has(w.toLowerCase()))
  const fem = new Set(libres.filter(w => /a$/.test(w) && libres.includes(w.replace(/a$/, 'o'))))
  const util = libres.filter(w => !fem.has(w))
  console.log(util.join(' · '))
  console.log(`\n(${util.length} libres, quitando femeninos gemelos)`)
}
main().finally(()=>p.$disconnect())
