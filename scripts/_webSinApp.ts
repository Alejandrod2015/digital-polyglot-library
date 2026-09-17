import { config } from 'dotenv'
config({ path: '.env.local' }); config({ path: '.env' })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()

async function main() {
  const signups = await p.betaSignup.findMany({
    where: { clerkUserId: { not: null }, status: { not: 'removed' } },
    select: { firstName: true, email: true, platform: true,
      targetLanguage: true, createdAt: true, lastActiveAt: true, clerkUserId: true },
    orderBy: { createdAt: 'asc' },
  })
  const ids = signups.map(s => s.clerkUserId!)
  const plats = await p.$queryRawUnsafe<any[]>(`
    SELECT "userId", metadata::jsonb->>'platform' plat, count(*) n, max("createdAt") last
    FROM dp_user_metrics_v1
    WHERE "userId" = ANY($1::text[]) AND metadata::jsonb ? 'platform'
    GROUP BY 1,2`, ids)
  const byUser = new Map<string, Record<string, { n: number; last: string }>>()
  for (const r of plats) {
    const m = byUser.get(r.userId) ?? {}
    m[r.plat] = { n: Number(r.n), last: new Date(r.last).toISOString().slice(0, 10) }
    byUser.set(r.userId, m)
  }
  const rows = signups.map(s => {
    const m = byUser.get(s.clerkUserId!) ?? {}
    const mobile = ['ios', 'android'].filter(k => m[k])
    return {
      usuario: s.firstName ?? s.email,
      email: s.email,
      alta: s.createdAt.toISOString().slice(0, 10),
      registro: s.platform,
      ultimaAct: s.lastActiveAt ? s.lastActiveAt.toISOString().slice(0, 10) : '-',
      web: m.web ? `${m.web.n} (${m.web.last})` : '-',
      app: mobile.length ? mobile.map(k => `${k} ${m[k].n} (${m[k].last})`).join(' + ') : 'NO',
    }
  })
  console.table(rows)
  const sinApp = rows.filter(r => r.app === 'NO' && r.web !== '-')
  console.log(`\nActivos en web y SIN rastro de app: ${sinApp.length} de ${rows.length}`)
  for (const r of sinApp) console.log(`- ${r.usuario} <${r.email}> (web: ${r.web})`)
  await p.$disconnect()
}
main()
