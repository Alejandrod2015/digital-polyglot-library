import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
async function main() {
  const rows: any[] = await p.betaSignup.findMany({ orderBy: { createdAt: 'asc' } })
  console.log('total', rows.length)
  const es = rows.filter(r => JSON.stringify(r).toLowerCase().includes('spanish'))
  console.log('mencionan spanish:', es.length)
  const counts: Record<string, number> = {}
  for (const r of es) { const k = `${r.language ?? '?'} / ${r.variant ?? '?'} / ${r.level ?? '?'}`; counts[k] = (counts[k]||0)+1 }
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${v}  ${k}`))
  console.log('\n--- texto libre (applicationReason + motivation Other) de los de espanol ---')
  for (const r of es) {
    const bits = [r.applicationReason, r.motivation].filter(Boolean).join(' | ')
    if (bits) console.log(`• [${r.level ?? '?'}/${r.variant ?? '?'}] ${bits.replace(/\s+/g,' ').slice(0,300)}`)
  }
}
main().finally(() => p.$disconnect())
