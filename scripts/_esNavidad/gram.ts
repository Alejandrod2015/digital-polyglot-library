/** Lee las MISMAS marcas que mide scripts/_gramProbe.ts (importa su RE) y las
 *  imprime una por una, para revisarlas a mano. No es una segunda medida. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true })
import { PrismaClient } from '../../src/generated/prisma'
import { RE } from '../_gramProbe'
const p = new PrismaClient()
async function main() {
  const id = process.argv[2]
  const topic = process.argv[3]
  const rows = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null }, ...(topic ? { topic } : {}) }, select: { text: true } })
  const t = rows.map(r => r.text!).join('\n')
  const fr = t.replace(/\n+/g, ' ').split(/(?<=[.!?”"])\s+/).filter(f => f.trim().length > 1).length
  console.log(`${rows.length} historias · ${fr} oraciones${topic ? ` · tema ${topic}` : ' · journey entero'}`)
  for (const [n, re] of RE) {
    const m = t.match(re) ?? []
    console.log(`\n${n}: ${m.length} marcas · ${Math.round(100 * m.length / fr)} por 100 oraciones`)
    if (m.length) console.log(`   ${m.join(' · ')}`)
  }
}
main().finally(() => p.$disconnect())
