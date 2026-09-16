import { PrismaClient } from '../../src/generated/prisma'
import { assertLadderContiguous } from '../../src/lib/journeyLadder'
const p = new PrismaClient()
async function main() {
  const ex = await p.journey.findMany({ select: { id: true, name: true, language: true, variant: true, levels: true, status: true } })
  for (const [name, variant, level] of [['Cultural','mexico','b1'],['Cultural','mexico','a2'],['Cultural','latam','b1'],['Friends','latam','b1'],['Friends','mexico','a2']] as const) {
    try { assertLadderContiguous({ name, language: 'spanish', variant, levels: [level] }, ex as any); console.log(`PASA   ${name}/${variant}/${level}`) }
    catch (e: any) { console.log(`TIRA   ${name}/${variant}/${level}: ${String(e.message).split('\n')[0]}`) }
  }
}
main().finally(()=>p.$disconnect())
