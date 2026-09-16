import { PrismaClient } from '../../src/generated/prisma'
import { isSpanishUpToLevel } from '../../src/lib/cefr/spanishLevels'
const p = new PrismaClient()
const CAMPOS: Record<string, string[]> = {
  '1 Hosting & Processions': ['posada','peregrino','letanía','villancico','vela','farol','ponche','colación','anfitrión','hospedar','tocar la puerta','negar','recibir','cortejo','fila','rezo','pedir posada','alojar','techo','turno','vecindad','callejón','patio','invitación','apuntarse'],
  '2 Crafts & Contests': ['rábano','tallar','navaja','figura','concurso','jurado','premio','puesto','fila','madrugar','montar','exhibir','marchitarse','delicado','pulso','tallado','artesanía','competir','descalificar','inscribirse','plazo','carpa','zócalo','mano'],
  '3 Feasts & Toasts': ['brindis','bacalao','pavo','romeritos','cena','sobremesa','platillo','guiso','recalentar','servir','copa','salud','discurso','agradecer','sentar','cabecera','mantel','sobrar','porción','repartir','horno','sazón','probar','apurarse'],
  '4 Visits & Leftovers': ['recalentado','visita','tupper','llevar','sobras','pasar a saludar','compromiso','cuñado','aparecerse','despedirse','cargar','tacaño','generoso','anfitriona','portón','banqueta','saludo','pretexto','excusa','quedar mal'],
  '5 Luck & Superstitions': ['uva','propósito','maleta','suerte','deseo','cábala','medianoche','cohete','año viejo','quemar','abrazo','apagar','encender','creer','burlarse','superstición','ritual','cumplir','fallar','prometer','vuelta a la manzana'],
  '6 Bakeries & Sharing': ['rosca','muñeco','panadería','horno','rebanada','cuchillo','partir','tocar','esconder','fingir','trampa','turno','chocolate','charola','fila','encargo','masa','azúcar','suerte','sorteo','tramposo'],
  '7 Debts & Payback': ['tamal','atole','deuda','cumplir','pagar','palabra','compromiso','fiesta','organizar','cobrar','perdonar','saldar','excusa','plazo','confianza','quedar bien','a medias','de buena fe','hacerse cargo','ganancia','temporada'],
}
async function main() {
  const js = await p.journey.findMany({ where: { language: 'spanish', status: { in: ['active','draft'] } }, select: { id: true, name: true } })
  const taken = new Map<string, string>()
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } })
    for (const s of ss) for (const v of (s.vocab as any[] ?? [])) {
      const w = String(v?.word ?? '').toLowerCase().trim(); if (w) taken.set(w, j.name)
    }
  }
  console.log(`plazas ya ensenadas en espanol live+draft: ${taken.size} palabras distintas\n`)
  for (const [tema, ws] of Object.entries(CAMPOS)) {
    const dentro = ws.filter(w => isSpanishUpToLevel(w, 'b1'))
    const fuera = ws.filter(w => !isSpanishUpToLevel(w, 'b1'))
    const choca = ws.filter(w => taken.has(w.toLowerCase()))
    console.log(`## ${tema}`)
    console.log(`  EN LISTA B1 (${dentro.length}/${ws.length}): ${dentro.join(', ')}`)
    console.log(`  FUERA DE LISTA (${fuera.length}): ${fuera.join(', ')}`)
    console.log(`  YA ENSENADAS por otro journey ES (${choca.length}): ${choca.map(w=>`${w}<-${taken.get(w.toLowerCase())}`).join(', ') || '-'}\n`)
  }
}
main().finally(()=>p.$disconnect())
