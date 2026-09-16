import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
async function main() {
  const js = await p.journey.findMany({
    where: { language: 'spanish', status: { in: ['active', 'draft'] } },
    orderBy: [{ variant: 'asc' }, { name: 'asc' }],
  })
  const slugs = new Set<string>()
  for (const j of js) {
    console.log(`\n== ${j.status} | ${j.name} | ${j.variant} | ${j.levels.join(',')} | ${j.id}`)
    j.topics.forEach(t => slugs.add(t))
    const ts = await p.topic.findMany({ where: { slug: { in: j.topics } } })
    const bySlug = new Map(ts.map(t => [t.slug, t.label]))
    console.log('  ' + j.topics.map(s => `${bySlug.get(s) ?? '??'} [${s}]`).join(' · '))
  }
  console.log('\n\n== TODOS los slugs de Topic que contienen navid/christmas/fiesta/holiday ==')
  const nav = await p.topic.findMany({ where: { OR: [
    { slug: { contains: 'christmas' } }, { label: { contains: 'Christmas' } },
    { slug: { contains: 'holiday' } }, { label: { contains: 'Holiday' } },
    { slug: { contains: 'festiv' } }, { label: { contains: 'Festiv' } },
    { slug: { contains: 'celebra' } }, { label: { contains: 'Celebra' } },
    { slug: { contains: 'tradition' } }, { label: { contains: 'Tradition' } },
  ] } })
  nav.forEach(t => console.log(`  ${t.label} [${t.slug}] universal=${t.isUniversal}`))
}
main().finally(() => p.$disconnect())
