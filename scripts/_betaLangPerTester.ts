import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()
type Key = { lang: string; variant: string }

async function buildResolver() {
  const map = new Map<string, Key>()
  const norm = (l?: string|null, v?: string|null, r?: string|null): Key => ({ lang: (l||'unknown').toLowerCase(), variant: (v||r||'sin marcar').toLowerCase() })
  const sa = await p.standaloneStory.findMany({ select: { slug:true, language:true, variant:true, region:true } })
  for (const s of sa) map.set(s.slug, norm(s.language, s.variant, s.region))
  const cs = await p.catalogStory.findMany({ select: { slug:true, language:true, variant:true, region:true, book:{select:{language:true,variant:true,region:true}} } })
  for (const s of cs) if (!map.has(s.slug)) map.set(s.slug, norm(s.language||s.book.language, s.variant||s.book.variant, s.region||s.book.region))
  const js = await p.journeyStory.findMany({ select: { id:true, slug:true, journey:{select:{language:true,variant:true}} } })
  for (const s of js) { const k = norm(s.journey.language, s.journey.variant)
    map.set(`journey-${s.id}`, k); map.set(`journey:${s.id}`, k); if (s.slug && !map.has(s.slug)) map.set(s.slug, k) }
  return map
}
const CONSUMPTION = new Set(['story_opened','audio_play','audio_pause','audio_complete','continue_listening','vocab_clicked','practice_session_started','practice_session_completed','practice_recommended_mode_opened','journey_topic_opened','journey_story_read','story_rated','practice_rated','speed_change','seek'])

async function main(){
  const resolver = await buildResolver()
  const beta = await p.betaSignup.findMany({ where:{ clerkUserId:{not:null} }, select:{ clerkUserId:true, email:true, targetLanguage:true, targetVariant:true, createdAt:true } })
  const ids = beta.map(b=>b.clerkUserId!)
  const meta = new Map(beta.map(b=>[b.clerkUserId!, b]))
  const events = await p.$queryRawUnsafe<any[]>(`
    SELECT "userId","eventType","storySlug","createdAt", metadata::jsonb->>'language' AS mlang, metadata::jsonb->>'variant' AS mvar
    FROM dp_user_metrics_v1 WHERE "userId" = ANY($1::text[]) ORDER BY "userId","createdAt"`, ids)
  const rawKey = (e:any): Key|null => { if(!CONSUMPTION.has(e.eventType)) return null
    const r = resolver.get(e.storySlug); if (r) return r
    if (e.mlang) return { lang: e.mlang.toLowerCase(), variant: (e.mvar||'sin marcar').toLowerCase() }; return null }
  const seen = new Map<string, Map<string, Set<string>>>()
  for (const e of events){ const k=rawKey(e); if(!k||k.variant==='sin marcar') continue
    if(!seen.has(e.userId)) seen.set(e.userId,new Map()); const m=seen.get(e.userId)!
    if(!m.has(k.lang)) m.set(k.lang,new Set()); m.get(k.lang)!.add(k.variant) }
  const key=(e:any):Key|null=>{ const k=rawKey(e); if(!k) return k; if(k.variant!=='sin marcar') return k
    const vs=seen.get(e.userId)?.get(k.lang); return vs&&vs.size===1?{lang:k.lang,variant:[...vs][0]}:k }

  // sesiones por (usuario, idioma/variante)
  const GAP = 15*60*1000
  const per = new Map<string, { sec:number; ev:number; days:Set<string>; stories:Set<string>; last:Date|null }>()
  const byUser = new Map<string, any[]>()
  for (const e of events){ if(!CONSUMPTION.has(e.eventType)) continue
    if(!byUser.has(e.userId)) byUser.set(e.userId,[]); byUser.get(e.userId)!.push(e) }
  for (const [u,evs] of byUser){ let i=0
    while(i<evs.length){ let j=i
      while(j+1<evs.length && +new Date(evs[j+1].createdAt)-+new Date(evs[j].createdAt)<=GAP) j++
      const span=(+new Date(evs[j].createdAt)-+new Date(evs[i].createdAt))/1000
      const langs=new Map<string,Key>()
      for(let x=i;x<=j;x++){ const k=key(evs[x]); if(k) langs.set(`${k.lang}|${k.variant}`,k) }
      if(langs.size&&span>0){ const share=span/langs.size
        for(const [id] of langs){ const kk=`${u}||${id}`
          if(!per.has(kk)) per.set(kk,{sec:0,ev:0,days:new Set(),stories:new Set(),last:null})
          per.get(kk)!.sec+=share } }
      i=j+1 } }
  for (const e of events){ const k=key(e); if(!k) continue
    const kk=`${e.userId}||${k.lang}|${k.variant}`
    if(!per.has(kk)) per.set(kk,{sec:0,ev:0,days:new Set(),stories:new Set(),last:null})
    const r=per.get(kk)!; r.ev++; r.days.add(new Date(e.createdAt).toISOString().slice(0,10)); r.stories.add(e.storySlug)
    if(!r.last||new Date(e.createdAt)>r.last) r.last=new Date(e.createdAt) }

  // agrupar por variante
  const g = new Map<string, any[]>()
  for (const [kk,v] of per){ const [u,lv]=kk.split('||')
    if(!g.has(lv)) g.set(lv,[]); g.get(lv)!.push({ u, ...v }) }
  const rows=[...g.entries()].map(([lv,us])=>{
    const mins=us.map(x=>x.sec/60).sort((a,b)=>b-a)
    const tot=mins.reduce((a,b)=>a+b,0)
    return { lv, testers:us.length, tot, median:mins[Math.floor(mins.length/2)], top1:mins[0], top1pct: tot?mins[0]/tot*100:0,
      dias: us.reduce((a:number,x:any)=>a+x.days.size,0), activos: us.filter((x:any)=>x.days.size>=2).length,
      ultimo: us.map((x:any)=>x.last).sort((a:any,b:any)=>+b-+a)[0] }
  }).sort((a,b)=>b.tot-a.tot)
  console.log('| lang/variant | testers | min tot | min/tester | mediana | top1 min | top1 % | dias activos | testers >=2 dias | ultimo evento |')
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |')
  for(const r of rows) console.log(`| ${r.lv} | ${r.testers} | ${Math.round(r.tot)} | ${Math.round(r.tot/r.testers)} | ${Math.round(r.median)} | ${Math.round(r.top1)} | ${Math.round(r.top1pct)}% | ${r.dias} | ${r.activos} | ${r.ultimo?.toISOString().slice(0,10)} |`)

  // reparto individual dentro de latam / spain / brazil
  for (const lv of ['spanish|latam','spanish|spain','portuguese|brazil']){
    console.log(`\n${lv}:`)
    for (const x of (g.get(lv)||[]).sort((a,b)=>b.sec-a.sec))
      console.log(`  ${String(Math.round(x.sec/60)).padStart(4)} min  ${String(x.days.size).padStart(2)} dias  ${String(x.stories.size).padStart(2)} hist  ${meta.get(x.u)?.email}  (pidio ${meta.get(x.u)?.targetLanguage}/${meta.get(x.u)?.targetVariant ?? '-'})`)
  }
  // testers con cuenta y CERO consumo
  const cero = beta.filter(b=>!byUser.has(b.clerkUserId!))
  console.log(`\nCERO consumo (${cero.length}/${beta.length}):`)
  for(const c of cero) console.log(`  ${c.email}  pidio ${c.targetLanguage}/${c.targetVariant ?? '-'}  alta ${c.createdAt.toISOString().slice(0,10)}`)
}
main().finally(()=>p.$disconnect())
