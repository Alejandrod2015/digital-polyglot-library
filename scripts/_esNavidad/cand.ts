import { PrismaClient } from '../../src/generated/prisma'
import { isSpanishUpToLevel } from '../../src/lib/cefr/spanishLevels'
const p = new PrismaClient()
const ANCLAS = ['alasita','ekeko','yatiri','challa','challar','serpentina','mistura','tari','aguayo','caserito','paceño','alteño','chuño','api','salteña','cholita','bombín','feria de miniaturas','al mediodía en punto','de fábrica']
const PORT = ['frustración','decepción','desilusión','nostalgia','compasión','celos','indignación','melancolía','vergüenza','orgullo','alivio','culpa','rencor','envidia','ternura','apuro','desgana','remordimiento','terco','testarudo','avergonzado','decepcionado','aliviado','ansioso','resignado','mezquino','generoso','sincero','hipócrita','fingir','disimular','confesar','callarse','apurarse','arrepentirse','resignarse','deber un favor','quedar mal','dar la cara','hacerse el tonto','morderse la lengua','a regañadientes','de mala gana','sin pensarlo dos veces','por si acaso','a escondidas','tallado','artesano','regalo','deseo','fila','cola','bendecir','envolver','pesar','valer','venta','ganancia','cliente','cuaderno','apuntar','nombre','teléfono','madera','yeso','mano','palma','uña','herramienta','taller','bolsillo','billete','falso','pieza','alcohol','papel','abogado','camión','casita','título','suerte','creer','promesa','trato','precio','rebajar','regatear']
async function main() {
  const js = await p.journey.findMany({ where: { language: 'spanish', status: { in: ['active','draft'] } }, select: { id: true, name: true } })
  const taken = new Map<string, string>()
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } })
    for (const s of ss) for (const v of (s.vocab as any[] ?? [])) {
      const w = String(v?.word ?? '').toLowerCase().trim(); if (w) taken.set(w, j.name)
    }
  }
  const fmt = (w: string) => `${w}${taken.has(w.toLowerCase()) ? ` [OCUPADA:${taken.get(w.toLowerCase())}]` : ''}${isSpanishUpToLevel(w,'b1') ? '' : ' {fuera de lista}'}`
  console.log('== ANCLAS ==')
  ANCLAS.forEach(w => console.log('  ' + fmt(w)))
  console.log('\n== PORTABLES libres Y en lista B1 ==')
  const ok = PORT.filter(w => !taken.has(w.toLowerCase()) && isSpanishUpToLevel(w,'b1'))
  console.log('  ' + ok.join(', '))
  console.log(`\n  (${ok.length} de ${PORT.length} candidatas)`)
  console.log('\n== PORTABLES descartadas ==')
  PORT.filter(w => taken.has(w.toLowerCase()) || !isSpanishUpToLevel(w,'b1')).forEach(w => console.log('  ' + fmt(w)))
}
main().finally(()=>p.$disconnect())
