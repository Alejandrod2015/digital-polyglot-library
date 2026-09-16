import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
const T: [string,string][] = [
  ['Wishes & Bargaining','wishes-and-bargaining'],
  ['Turns & Belonging','turns-and-belonging'],
  ['Vigils & Waiting','vigils-and-waiting'],
  ['Weight & Endurance','weight-and-endurance'],
  ['Stalls & Crowds','stalls-and-crowds'],
  ['Hosting & Processions','hosting-and-processions'],
  ['Endings & Forgiveness','endings-and-forgiveness'],
]
async function main() {
  const s = await p.topic.findMany({ where: { slug: { in: T.map(t=>t[1]) } } })
  const l = await p.topic.findMany({ where: { label: { in: T.map(t=>t[0]) } } })
  console.log('slugs ocupados:', s.map(t=>t.slug).join(', ') || 'ninguno')
  console.log('labels ocupados:', l.map(t=>`${t.label}[${t.slug}]`).join(', ') || 'ninguno')
}
main().finally(()=>p.$disconnect())
