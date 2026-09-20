// Candidatos para autorar estaciones de la prueba de escucha: por variante y
// nivel, cada historia live con audio y sus fragmentos (duracion, texto y las
// palabras del vocab que aparecen en cada uno). Uso:
//   npx tsx scripts/_esLevelTestCandidates.ts latam b1

import { config } from 'dotenv'
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()
type Frag = { url:string; text:string; index:number; startSec:number; endSec:number; speaker?:string }
const norm = (s:string)=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
async function main(){
  const variant = process.argv[2]; const level = process.argv[3]
  const js = await p.journey.findMany({ where:{ variant, status:'active', levels:{ has: level } },
    select:{ typeSlug:true, stories:{ where:{ audioUrl:{ not:null } }, orderBy:[{topic:'asc'},{slotIndex:'asc'}], select:{ slug:true, title:true, topic:true, slotIndex:true, synopsis:true, audioFragments:true, vocab:true } } } })
  for (const j of js) for (const s of j.stories){
    const frags = (s.audioFragments as Frag[]) ?? []
    const vocab = ((s.vocab as any[])||[]).map(v=>({ word:v.word as string, def:v.definition as string }))
    console.log(`\n##### ${variant}/${level} ${j.typeSlug} | ${s.topic} #${s.slotIndex} | ${s.slug} | "${s.title}"\nSINOPSIS: ${s.synopsis}`)
    for (let i=1;i<frags.length;i++){
      const f=frags[i]; const dur=(f.endSec-f.startSec).toFixed(1)
      const hits = vocab.filter(v=>norm(f.text).includes(norm(v.word))).map(v=>v.word)
      console.log(`  [${i}] ${dur}s ${f.speaker??''} vocab=${hits.join(',')||'-'}\n      ${f.text}`)
    }
    console.log(`  VOCAB: ${vocab.map(v=>`${v.word}=${v.def}`).join(' | ')}`)
  }
  await p.$disconnect()
}
main()
