import { PrismaClient } from '../../src/generated/prisma'
import { assertTopicsGrounded } from '../../src/lib/topicEvidence'
const p = new PrismaClient()
const TEMAS = [
  ['Hosting & Processions','hosting-and-processions'],
  ['Crafts & Contests','crafts-and-contests'],
  ['Feasts & Toasts','feasts-and-toasts'],
  ['Visits & Leftovers','visits-and-leftovers'],
  ['Luck & Superstitions','luck-and-superstitions'],
  ['Bakeries & Sharing','bakeries-and-sharing'],
  ['Debts & Payback','debts-and-payback'],
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
    await assertTopicsGrounded({ language: 'spanish', proposals: TEMAS.map(([label, slug]) => ({ label, slug })), journeyEvidence: CITAS, existingLabels: exist.map(t=>t.label), prisma: p })
    console.log('PASA: assertTopicsGrounded journey-level')
  } catch (e: any) { console.log('TIRA:\n' + e.message) }
}
main().finally(()=>p.$disconnect())
