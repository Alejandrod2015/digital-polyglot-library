import { PrismaClient } from '../../src/generated/prisma'
import * as fs from 'fs'
const p = new PrismaClient()
async function main() {
  const j = await p.journey.findUnique({ where: { id: 'cmu410zep000732szrw94t2sl' } })
  const ss = await p.journeyStory.findMany({ where: { journeyId: j!.id }, orderBy: [{ topic: 'asc' }, { slotIndex: 'asc' }] })
  const order = j!.topics
  ss.sort((a, b) => order.indexOf(a.topic) - order.indexOf(b.topic) || a.slotIndex - b.slotIndex)
  const t7 = JSON.parse(fs.readFileSync('scripts/_esNavidad/t7-data.json', 'utf8'))
  const arr = ss.filter(s => s.slug && s.text).map(s => ({ slug: s.slug, topic: s.topic, text: s.text }))
  const t7s = (t7.stories ?? t7).map((s: any) => ({ slug: s.slug, topic: 'endings-and-forgiveness', text: s.text }))
  const all = [...arr, ...t7s]
  fs.writeFileSync('/tmp/veintiuna.json', JSON.stringify(all, null, 1))
  for (const s of all) console.log(`\n===== ${s.topic} | ${s.slug}\n${s.text}`)
}
main().finally(() => p.$disconnect())
