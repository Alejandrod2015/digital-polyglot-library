/** DIAGNOSTICO, no medida: la cifra que manda es la del gate (escalera.ts).
 *  Esto solo dice DONDE estan las plazas que salen una sola vez. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true })
import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
async function main() {
  const id = process.argv[2]
  const rows = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { topic: true, text: true, vocab: true } })
  const todo = rows.map(r => r.text!).join('\n').toLowerCase()
  for (const tema of [...new Set(rows.map(r => r.topic))]) {
    const plazas = rows.filter(r => r.topic === tema).flatMap(r => (r.vocab as any[] ?? []))
    let una = 0, anc = 0
    const solas: string[] = []
    for (const v of plazas) {
      const s = String(v.surface ?? v.word).toLowerCase()
      const n = todo.split(s).length - 1
      if (v.register === 'cultural') anc++
      if (n <= 1) { una++; solas.push(`${v.word}${v.register === 'cultural' ? '*' : ''}`) }
    }
    console.log(`\n${tema}: ${plazas.length} plazas · ${anc} ancladas · ${una} salen una sola vez`)
    console.log(`  solas: ${solas.join(', ')}`)
  }
}
main().finally(() => p.$disconnect())
