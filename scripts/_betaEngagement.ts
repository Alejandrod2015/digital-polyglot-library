import { config } from 'dotenv'
config({ path: '.env.local' }); config({ path: '.env' })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()

type Key = { lang: string; variant: string }
const CONSUMPTION = new Set(['story_opened','audio_play','audio_pause','audio_complete','continue_listening','vocab_clicked','practice_session_started','practice_session_completed','practice_recommended_mode_opened','journey_topic_opened','journey_story_read','story_rated','practice_rated','speed_change','seek'])

async function buildResolver() {
  const map = new Map<string, Key>()
  const norm = (l?: string|null, v?: string|null, r?: string|null): Key => ({ lang: (l||'unknown').toLowerCase(), variant: (v||r||'-').toLowerCase() })
  const sa = await p.standaloneStory.findMany({ select: { slug:true, language:true, variant:true, region:true } })
  for (const s of sa) map.set(s.slug, norm(s.language, s.variant, s.region))
  const cs = await p.catalogStory.findMany({ select: { slug:true, language:true, variant:true, region:true, book:{select:{language:true,variant:true,region:true}} } })
  for (const s of cs) if (!map.has(s.slug)) map.set(s.slug, norm(s.language||s.book.language, s.variant||s.book.variant, s.region||s.book.region))
  const js = await p.journeyStory.findMany({ select: { id:true, slug:true, journey:{select:{language:true,variant:true}} } })
  for (const s of js) { const k = norm(s.journey.language, s.journey.variant)
    map.set(`journey-${s.id}`, k); map.set(`journey:${s.id}`, k); if (s.slug && !map.has(s.slug)) map.set(s.slug, k) }
  return map
}

const DAY = 86400000
const d10 = (d: Date | string) => new Date(d).toISOString().slice(0,10)

async function main(){
  const resolver = await buildResolver()
  const signups = await p.betaSignup.findMany({
    select: { id:true, firstName:true, email:true, targetLanguage:true, targetVariant:true, currentLevel:true,
      platform:true, status:true, weeklyHours:true, motivation:true, createdAt:true, invitedAt:true,
      ascInvitedAt:true, planGrantedAt:true, lastActiveAt:true, clerkUserId:true, decision:true },
    orderBy: { createdAt: 'asc' },
  })
  const linked = signups.filter(s => s.clerkUserId)
  const ids = linked.map(s => s.clerkUserId!)

  const events = await p.$queryRawUnsafe<any[]>(`
    SELECT "userId","eventType","storySlug","createdAt",
           (metadata::jsonb->>'progressSec')::float AS prog,
           (metadata::jsonb->>'audioDurationSec')::float AS dur,
           metadata::jsonb->>'language' AS mlang, metadata::jsonb->>'variant' AS mvar
    FROM dp_user_metrics_v1 WHERE "userId" = ANY($1::text[]) ORDER BY "userId","createdAt"`, ids)

  const feedback = await p.betaFeedback.groupBy({ by:['signupId'], _count:true })
  const fbBySignup = new Map(feedback.map(f => [f.signupId, f._count]))

  const byUser = new Map<string, any[]>()
  for (const e of events) { if(!byUser.has(e.userId)) byUser.set(e.userId, []); byUser.get(e.userId)!.push(e) }

  const rows: any[] = []
  for (const s of signups) {
    const evs = s.clerkUserId ? (byUser.get(s.clerkUserId) ?? []) : []
    const cons = evs.filter(e => CONSUMPTION.has(e.eventType))
    const count = (t: string) => evs.filter(e => e.eventType === t).length
    const days = new Set(cons.map(e => d10(e.createdAt)))
    const stories = new Set(cons.filter(e => e.storySlug).map(e => e.storySlug))

    // sesiones: gap de 15 min sobre eventos de consumo
    const GAP = 15*60*1000
    let sessions = 0, sec = 0
    for (let i=0; i<cons.length; ) {
      let j = i
      while (j+1 < cons.length && +new Date(cons[j+1].createdAt) - +new Date(cons[j].createdAt) <= GAP) j++
      sessions++
      sec += (+new Date(cons[j].createdAt) - +new Date(cons[i].createdAt))/1000
      i = j+1
    }
    const langs = new Set<string>()
    for (const e of cons) { const k = resolver.get(e.storySlug) ?? (e.mlang ? { lang: e.mlang.toLowerCase(), variant: '-' } : null); if (k) langs.add(k.lang) }

    const first = cons.length ? new Date(cons[0].createdAt) : null
    const last = cons.length ? new Date(cons[cons.length-1].createdAt) : null
    // semanas desde su primer evento
    const weekBuckets: number[] = []
    if (first) for (const e of cons) { const w = Math.floor((+new Date(e.createdAt) - +first)/(7*DAY)); weekBuckets[w] = (weekBuckets[w]??0)+1 }

    rows.push({
      name: s.firstName ?? '-', email: s.email, status: s.status, platform: s.platform,
      lang: s.targetLanguage, variant: s.targetVariant ?? '-', level: s.currentLevel,
      hours: s.weeklyHours ?? '-', motivation: s.motivation ?? '-',
      signedUp: d10(s.createdAt), invited: s.ascInvitedAt ? d10(s.ascInvitedAt) : (s.invitedAt ? d10(s.invitedAt) : '-'),
      linked: !!s.clerkUserId,
      first: first ? d10(first) : '-', last: last ? d10(last) : '-',
      daysSinceLast: last ? Math.floor((Date.now() - +last)/DAY) : null,
      lifespanDays: first && last ? Math.round((+last - +first)/DAY) : null,
      activeDays: days.size, sessions, minutes: Math.round(sec/60),
      events: cons.length, stories: stories.size,
      opened: count('story_opened'), plays: count('audio_play'), completes: count('audio_complete'),
      pStart: count('practice_session_started'), pDone: count('practice_session_completed'),
      vocab: count('vocab_clicked'), reminders: count('reminder_scheduled'),
      onbFin: count('onboarding_finished'), onbAband: count('onboarding_abandoned'),
      plansViewed: count('plans_viewed'), rated: count('story_rated'),
      langs: [...langs].join('+') || '-',
      feedback: fbBySignup.get(s.id) ?? 0,
      weeks: weekBuckets.map(x => x ?? 0).join('/'),
    })
  }

  console.log(JSON.stringify(rows, null, 1))
  await p.$disconnect()
}
main()
