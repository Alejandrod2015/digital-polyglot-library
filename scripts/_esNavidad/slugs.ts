import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
const S = ['hosting-and-processions','crafts-and-contests','feasts-and-toasts','visits-and-leftovers','luck-and-superstitions','bakeries-and-sharing','debts-and-payback']
const L = ['Hosting & Processions','Crafts & Contests','Feasts & Toasts','Visits & Leftovers','Luck & Superstitions','Bakeries & Sharing','Debts & Payback']
async function main() {
  const bySlug = await p.topic.findMany({ where: { slug: { in: S } } })
  const byLabel = await p.topic.findMany({ where: { label: { in: L } } })
  console.log('slugs ocupados:', bySlug.map(t=>t.slug).join(', ') || 'ninguno')
  console.log('labels ocupados:', byLabel.map(t=>`${t.label}[${t.slug}]`).join(', ') || 'ninguno')
  console.log('total topics en base:', await p.topic.count())
}
main().finally(()=>p.$disconnect())
