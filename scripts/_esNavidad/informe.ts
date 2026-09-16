import * as fs from 'fs'
import { isSpanishUpToLevel } from '../../src/lib/cefr/spanishLevels'
const REG = new Set(['frustración','decepción','desilusión','nostalgia','compasión','celos','indignación','melancolía','ternura','admiración','desprecio','irritado','decepcionado','molesto','pena','ganas','gana','pertenecer','discreto','prudente','humilde','modesto','tolerar','renunciar','negarse','creencia','privilegio','suponer','genuino','obstáculo','resistir','recompensa','logro'])
const d = JSON.parse(fs.readFileSync('scripts/_esNavidad/t1-data.json','utf8'))
let tA=0,tD=0,tF=0,tR=0
for (const s of d) {
  const anc = s.vocab.filter((v:any)=>v.register==='cultural')
  const dentro = s.vocab.filter((v:any)=>v.register!=='cultural' && isSpanishUpToLevel(v.word,'b1'))
  const fuera = s.vocab.filter((v:any)=>v.register!=='cultural' && !isSpanishUpToLevel(v.word,'b1'))
  const reg = s.vocab.filter((v:any)=>REG.has(v.word))
  tA+=anc.length; tD+=dentro.length; tF+=fuera.length; tR+=reg.length
  console.log(`| ${s.title} | ${String(s.text).split(/\s+/).length} | ${s.vocab.length} | ${anc.length} | ${dentro.length} | ${fuera.length} | ${reg.length} |`)
  console.log(`    anclas: ${anc.map((v:any)=>v.word).join(', ')}`)
  console.log(`    registro emocional: ${reg.map((v:any)=>v.word).join(', ')}`)
}
console.log(`\nTOTAL 60 plazas: ${tA} anclas · ${tD} dentro de lista B1 · ${tF} fuera de lista sin ser ancla · ${tR} del registro emocional`)
