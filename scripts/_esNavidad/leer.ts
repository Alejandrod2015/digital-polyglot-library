import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true })
import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
async function main() {
  const j = await p.journey.findUnique({ where: { id: process.argv[2] } })
  const rows = await p.journeyStory.findMany({ where: { journeyId: j!.id, text: { not: null } } })
  const orden = j!.topics
  rows.sort((a,b) => orden.indexOf(a.topic) - orden.indexOf(b.topic) || a.slotIndex - b.slotIndex)
  for (const r of rows) {
    console.log(`\n### ${orden.indexOf(r.topic)+1}.${r.slotIndex} ${r.title}`)
    console.log(r.text)
  }
}
main().finally(()=>p.$disconnect())
