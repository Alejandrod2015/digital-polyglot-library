import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
async function main() {
  const rows = await p.betaSignup.findMany({ where: { targetLanguage: { contains: 'panish' } } })
  console.log('solicitudes de espanol:', rows.length, 'de', await p.betaSignup.count())
  const by = (f: (r: any) => string) => { const c: Record<string, number> = {}; rows.forEach(r => { const k = f(r) || '(vacio)'; c[k] = (c[k]||0)+1 }); return Object.entries(c).sort((a,b)=>b[1]-a[1]) }
  console.log('\nNIVEL declarado:'); by(r=>r.currentLevel).forEach(([k,v])=>console.log(`  ${v}  ${k}`))
  console.log('\nVARIANTE:'); by(r=>r.targetVariant).forEach(([k,v])=>console.log(`  ${v}  ${k}`))
  console.log('\nNIVEL x VARIANTE:'); by(r=>`${r.currentLevel} / ${r.targetVariant}`).forEach(([k,v])=>console.log(`  ${v}  ${k}`))
  console.log('\nMOTIVACION:'); by(r=>r.motivation).forEach(([k,v])=>console.log(`  ${v}  ${k}`))
}
main().finally(() => p.$disconnect())
