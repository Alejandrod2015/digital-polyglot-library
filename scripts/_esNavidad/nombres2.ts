import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
const STOP = new Set(['El','La','Los','Las','Un','Una','Y','Pero','Que','Cuando','Si','No','Se','De','A','En','Al','Del','Por','Para','Con','Su','Sus','Mi','Me','Te','Le','Lo','Ya','Ahora','Despues','Después','Entonces','Todo','Todos','Nadie','Algo','Asi','Así','Aqui','Aquí','Alli','Allí','Hoy','Manana','Mañana','Ayer','Esa','Ese','Esta','Este','Esto','Eso','Ella','El','Nosotros','Ellos','Nunca','Siempre','Mas','Más','Muy','Tambien','También','Solo','Sólo','Sin','Sobre','Desde','Hasta','Entre','Cada','Otro','Otra','Nada','Como','Cómo','Donde','Dónde','Quien','Quién','Porque','Aunque','Mientras','Luego','Antes','Primero','Navidad','Espana','España','Mexico','México'])
async function main() {
  const js = await p.journey.findMany({ where: { status: { in: ['active','draft'] }, language: 'spanish' }, select: { id: true, name: true, variant: true, levels: true } })
  const global = new Map<string, Set<string>>()
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true } })
    const txt = ss.map(s => s.text ?? '').join('\n')
    const cand = new Map<string, number>()
    for (const m of txt.matchAll(/(?<![.!?¡¿“"]\s)(?<!^)\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\b/gm)) {
      const w = m[1]; if (STOP.has(w)) continue; cand.set(w, (cand.get(w)||0)+1)
    }
    const top = [...cand.entries()].filter(([,n]) => n >= 5).sort((a,b)=>b[1]-a[1])
    console.log(`\n${j.name} ${j.variant} ${j.levels.join(',')}: ${top.map(([w,n])=>`${w}(${n})`).join(' ')}`)
    top.forEach(([w]) => { if (!global.has(w)) global.set(w, new Set()); global.get(w)!.add(`${j.name}/${j.variant}`) })
  }
  console.log('\n\n== OCUPADOS (>=5 apariciones en algun journey ES) ==')
  console.log([...global.keys()].sort().join(', '))
}
main().finally(()=>p.$disconnect())
