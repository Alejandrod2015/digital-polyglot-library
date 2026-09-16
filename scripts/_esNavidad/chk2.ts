import { PrismaClient } from '../../src/generated/prisma'
import { isSpanishUpToLevel } from '../../src/lib/cefr/spanishLevels'
const p = new PrismaClient()
async function main() {
  const js = await p.journey.findMany({ where: { language: 'spanish', status: { in: ['active','draft'] } }, select: { id: true, name: true } })
  const taken = new Map<string,string>()
  for (const j of js) { const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } })
    for (const s of ss) for (const v of (s.vocab as any[] ?? [])) { const w = String(v?.word ?? '').toLowerCase().trim(); if (w) taken.set(w, j.name) } }
  for (const w of process.argv.slice(2)) {
    console.log(`${isSpanishUpToLevel(w,'b1') ? 'B1ok ' : 'FUERA'} ${taken.has(w.toLowerCase()) ? 'OCUP ' : 'libre'}  ${w}`)
  }
}
main().finally(()=>p.$disconnect())
