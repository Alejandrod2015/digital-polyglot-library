import { PrismaClient } from '../../src/generated/prisma'
import { assertTopicsGrounded } from '../../src/lib/topicEvidence'
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
const CITAS = [
  'He lives with his grandmother who only speaks Spanish, I want to have my own conversations with her',
  'To help learn Spanish to be able to talk to my family',
  'to learn mexican spanish',
  'I really enjoy story-based learning to maintain and practice my level of Spanish',
]
async function main() {
  const exist = await p.topic.findMany({ select: { label: true } })
  try {
    await assertTopicsGrounded({ language: 'spanish', proposals: T.map(([label, slug]) => ({ label, slug })), journeyEvidence: CITAS, existingLabels: exist.map(t=>t.label), prisma: p })
    console.log('\nPASA: assertTopicsGrounded journey-level con los 7 nuevos')
  } catch (e: any) { console.log('TIRA:\n' + e.message) }
}
main().finally(()=>p.$disconnect())
