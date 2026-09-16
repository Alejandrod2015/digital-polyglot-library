import { PrismaClient } from '../../src/generated/prisma'
import { SPANISH_A1_A2_LEMMAS } from '../../src/lib/cefr/spanishA1A2'
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
  const a = [...SPANISH_A1_A2_LEMMAS], b = [...SPANISH_B1_LEMMAS]
  const libreA = a.filter(w => !taken.has(w.toLowerCase()))
  const libreB = b.filter(w => !taken.has(w.toLowerCase()))
  console.log(`lista A1/A2: ${a.length} lemas · libres ${libreA.length} (${Math.round(100*libreA.length/a.length)}%)`)
  console.log(`lista B1   : ${b.length} lemas · libres ${libreB.length} (${Math.round(100*libreB.length/b.length)}%)`)
  console.log(`\nnecesidad del journey: 21 historias x 13 portables = 273 plazas portables`)
  console.log(`headroom total (A1/A2 + B1 libres): ${libreA.length + libreB.length}`)
  console.log(`\nmuestra de 60 B1 libres: ${libreB.slice(0, 60).join(', ')}`)
}
main().finally(()=>p.$disconnect())
