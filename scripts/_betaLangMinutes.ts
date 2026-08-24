import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()

type Key = { lang: string; variant: string }

async function buildResolver() {
  const map = new Map<string, Key>()
  const norm = (l?: string | null, v?: string | null, r?: string | null): Key => ({
    lang: (l || 'unknown').toLowerCase(),
    variant: (v || r || 'sin marcar').toLowerCase(),
  })
  const sa = await p.standaloneStory.findMany({ select: { slug: true, language: true, variant: true, region: true } })
  for (const s of sa) map.set(s.slug, norm(s.language, s.variant, s.region))
  const cs = await p.catalogStory.findMany({ select: { slug: true, language: true, variant: true, region: true, book: { select: { language: true, variant: true, region: true } } } })
  for (const s of cs) if (!map.has(s.slug)) map.set(s.slug, norm(s.language || s.book.language, s.variant || s.book.variant, s.region || s.book.region))
  const js = await p.journeyStory.findMany({ select: { id: true, slug: true, journey: { select: { language: true, variant: true } } } })
  for (const s of js) {
    const k = norm(s.journey.language, s.journey.variant)
    map.set(`journey-${s.id}`, k); map.set(`journey:${s.id}`, k)
    if (s.slug && !map.has(s.slug)) map.set(s.slug, k)
  }
  return map
}

async function main() {
  const resolver = await buildResolver()
  const beta = await p.betaSignup.findMany({ where: { clerkUserId: { not: null } }, select: { clerkUserId: true, email: true } })
  const ids = beta.map(b => b.clerkUserId!)

  const events = await p.$queryRawUnsafe<any[]>(`
    SELECT "userId","eventType","storySlug","bookSlug","createdAt",
           (metadata::jsonb->>'progressSec')::float AS prog,
           (metadata::jsonb->>'audioDurationSec')::float AS dur,
           metadata::jsonb->>'language' AS mlang, metadata::jsonb->>'variant' AS mvar
    FROM dp_user_metrics_v1 WHERE "userId" = ANY($1::text[]) ORDER BY "userId","createdAt"`, ids)

  // Solo eventos de CONSUMO de contenido. Fuera: onboarding, signup, correos,
  // avisos, plans_viewed y journey_variant_selected (no son minutos de estudio).
  const CONSUMPTION = new Set(['story_opened','audio_play','audio_pause','audio_complete','continue_listening','vocab_clicked','practice_session_started','practice_session_completed','practice_recommended_mode_opened','journey_topic_opened','journey_story_read','story_rated','practice_rated','speed_change','seek'])
  const rawKey = (e: any): Key | null => {
    if (!CONSUMPTION.has(e.eventType)) return null
    const r = resolver.get(e.storySlug)
    if (r) return r
    if (e.mlang) return { lang: e.mlang.toLowerCase(), variant: (e.mvar || 'sin marcar').toLowerCase() }
    return null
  }

  // "sin marcar" viene de eventos que solo traen idioma en metadata (practice).
  // Si ese tester consumio UNA sola variante marcada de ese idioma, es esa.
  const seenByUser = new Map<string, Map<string, Set<string>>>()
  for (const e of events) {
    const k = rawKey(e); if (!k || k.variant === 'sin marcar') continue
    if (!seenByUser.has(e.userId)) seenByUser.set(e.userId, new Map())
    const m = seenByUser.get(e.userId)!
    if (!m.has(k.lang)) m.set(k.lang, new Set())
    m.get(k.lang)!.add(k.variant)
  }
  const key = (e: any): Key | null => {
    const k = rawKey(e); if (!k) return k
    if (k.variant !== 'sin marcar') return k
    const vs = seenByUser.get(e.userId)?.get(k.lang)
    return vs && vs.size === 1 ? { lang: k.lang, variant: [...vs][0] } : k
  }

  // --- audio minutes: furthest position per (user, story) ---
  const furthest = new Map<string, { k: Key; sec: number }>()
  for (const e of events) {
    if (!['audio_complete', 'audio_pause', 'audio_play', 'continue_listening'].includes(e.eventType)) continue
    const k = key(e); if (!k) continue
    const sec = e.eventType === 'audio_complete' ? (e.dur ?? e.prog ?? 0) : (e.prog ?? 0)
    if (!sec) continue
    const id = `${e.userId}|${e.storySlug}`
    const cur = furthest.get(id)
    if (!cur || sec > cur.sec) furthest.set(id, { k, sec })
  }
  const cl = await p.$queryRawUnsafe<any[]>(`
    SELECT "userId","storySlug","progressSec" FROM dp_continue_listening_v1 WHERE "userId" = ANY($1::text[])`, ids)
  for (const c of cl) {
    const k = resolver.get(c.storySlug); if (!k || !c.progressSec) continue
    const id = `${c.userId}|${c.storySlug}`
    const cur = furthest.get(id)
    if (!cur || c.progressSec > cur.sec) furthest.set(id, { k, sec: c.progressSec })
  }

  // --- engaged minutes: session clustering (gap > 15 min = new session) ---
  const GAP = 15 * 60 * 1000
  const engaged = new Map<string, number>()
  const byUser = new Map<string, any[]>()
  for (const e of events) {
    if (!CONSUMPTION.has(e.eventType)) continue
    if (!byUser.has(e.userId)) byUser.set(e.userId, [])
    byUser.get(e.userId)!.push(e)
  }
  for (const [, evs] of byUser) {
    let i = 0
    while (i < evs.length) {
      let j = i
      while (j + 1 < evs.length && +new Date(evs[j + 1].createdAt) - +new Date(evs[j].createdAt) <= GAP) j++
      const span = (+new Date(evs[j].createdAt) - +new Date(evs[i].createdAt)) / 1000
      // attribute the session to the language of its events (split evenly among distinct langs seen)
      const langs = new Map<string, Key>()
      for (let x = i; x <= j; x++) { const k = key(evs[x]); if (k) langs.set(`${k.lang}|${k.variant}`, k) }
      if (langs.size && span > 0) {
        const share = span / langs.size
        for (const [id] of langs) engaged.set(id, (engaged.get(id) || 0) + share)
      }
      i = j + 1
    }
  }

  // --- counters ---
  const agg = new Map<string, any>()
  const get = (k: Key) => {
    const id = `${k.lang}|${k.variant}`
    if (!agg.has(id)) agg.set(id, { lang: k.lang, variant: k.variant, audioSec: 0, engagedSec: 0, users: new Set(), opens: 0, vocab: 0, practice: 0, stories: new Set() })
    return agg.get(id)
  }
  for (const [id, f] of furthest) { const a = get(f.k); a.audioSec += f.sec; a.users.add(id.split('|')[0]) }
  for (const [id, sec] of engaged) { const [lang, variant] = id.split('|'); get({ lang, variant }).engagedSec += sec }
  for (const e of events) {
    if (!CONSUMPTION.has(e.eventType)) continue
    const k = key(e); if (!k) continue
    const a = get(k); a.users.add(e.userId); a.stories.add(e.storySlug)
    if (e.eventType === 'story_opened') a.opens++
    if (e.eventType === 'vocab_clicked') a.vocab++
    if (e.eventType === 'practice_session_completed') a.practice++
  }

  const rows = [...agg.values()].sort((a, b) => b.engagedSec - a.engagedSec)
  console.log('| Idioma | Variante | Min. sesión | Min. audio | Testers | Historias | Aperturas | Vocab | Práctica |')
  console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const r of rows) console.log(`| ${r.lang} | ${r.variant} | ${Math.round(r.engagedSec / 60)} | ${Math.round(r.audioSec / 60)} | ${r.users.size} | ${r.stories.size} | ${r.opens} | ${r.vocab} | ${r.practice} |`)

  const unres = events.filter(e => CONSUMPTION.has(e.eventType) && !key(e))
  const byslug = new Map<string, number>()
  for (const e of unres) byslug.set(`${e.bookSlug}/${e.storySlug}`, (byslug.get(`${e.bookSlug}/${e.storySlug}`) || 0) + 1)
  console.log(`\nSIN RESOLVER: ${unres.length} eventos de ${byslug.size} slugs`)
  console.log([...byslug.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s, n]) => `  ${n}  ${s}`).join('\n'))
  const dump = new Map<string, any>()
  for (const e of events) { if (!CONSUMPTION.has(e.eventType)) continue
    const k = key(e); const id = `${e.bookSlug}/${e.storySlug}`
    if (!dump.has(id)) dump.set(id, { n: 0, k: k ? `${k.lang}/${k.variant}` : 'NO RESUELTO' })
    dump.get(id).n++ }
  console.log('\n--- slugs consumidos ---')
  for (const [id, v] of [...dump.entries()].sort((a,b)=>b[1].n-a[1].n)) console.log(String(v.n).padStart(4), v.k.padEnd(22), id)
  console.log(`\nbeta con cuenta: ${ids.length} | con algún evento: ${byUser.size}`)
}
main().finally(() => p.$disconnect())
