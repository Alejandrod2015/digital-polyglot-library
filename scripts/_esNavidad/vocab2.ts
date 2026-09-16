import { PrismaClient } from '../../src/generated/prisma'
import { isSpanishUpToLevel } from '../../src/lib/cefr/spanishLevels'
const p = new PrismaClient()
const CAMPOS: Record<string, string[]> = {
  '1 BO Alasita · Wishes & Bargaining': ['alasita','ekeko','challar','casera','serpentina','cuadra','yeso','miniatura','regatear','deseo','billete','falso','pieza','palma','herramienta','bolsillo','envolver','advertir','taller','bendecir','rebajar','precio','trato','prometer','feria','puesto','mediodía','alcohol','papel','abogado'],
  '2 UY Llamadas · Turns & Belonging': ['candombe','comparsa','llamada','lonja','tambor','cuerda','ensayo','ensayar','turno','fila','barrio','vecino','aceptar','rechazar','pertenecer','apuntarse','afinar','fuego','cuero','ritmo','golpe','sudar','marchar','hombro','correa','permiso','orgullo','de memoria','hacer lugar','vos'],
  '3 GT Alfombras · Vigils & Waiting': ['alfombra','aserrín','teñir','molde','plantilla','rodilla','madrugada','amanecer','vela','incienso','procesión','pisar','barrer','desaparecer','esperar','aguantar','turnarse','cansancio','sueño','café','vecindario','pétalo','color','diseño','acabar','durar','de rodillas','toda la noche','valer la pena','quedarse'],
  '4 CO Silleteros · Weight & Endurance': ['silleta','silletero','cargar','peso','espalda','correa','flor','sembrar','cosecha','finca','ladera','subir','bajar','desfile','jurado','premio','ensayar','entrenar','aguantar','doler','sudor','descansar','heredar','terreno','abono','tallo','ramo','hombro','paso a paso','sin quejarse'],
  '5 CL Fiestas Patrias · Stalls & Crowds': ['fonda','volantín','encumbrar','hilo','curado','cueca','empanada','asado','ramada','permiso','municipalidad','carpa','multitud','apretar','cola','entrada','vender','ganancia','viento','cortar','enredar','bandera','pañuelo','zapatear','bailar','gritar','pagar','a codazos','en punto','se llenó'],
  '6 MX Posadas · Hosting & Processions': ['posada','peregrino','letanía','villancico','ponche','colación','piñata','farol','vela','anfitrión','hospedar','tocar','puerta','negar','recibir','alojar','vecindad','callejón','patio','invitación','turno','rezo','cortejo','romper','repartir','cantar','pedir','apuntarse','de casa en casa','no hay lugar'],
  '7 EC Año Viejo · Endings & Forgiveness': ['monigote','testamento','quemar','fuego','ceniza','muñeco','relleno','aserrín','máscara','año viejo','viuda','disfraz','perdonar','deuda','despedir','arrepentirse','escribir','leer','confesar','olvidar','culpa','abrazo','medianoche','arder','humo','saltar','empezar','de nuevo','dejar ir','hacer las paces'],
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
  let tD = 0, tF = 0, tO = 0, tT = 0
  for (const [tema, ws] of Object.entries(CAMPOS)) {
    const libre = ws.filter(w => !taken.has(w.toLowerCase()))
    const dentro = libre.filter(w => isSpanishUpToLevel(w, 'b1'))
    const fuera = libre.filter(w => !isSpanishUpToLevel(w, 'b1'))
    const ocup = ws.filter(w => taken.has(w.toLowerCase()))
    tD += dentro.length; tF += fuera.length; tO += ocup.length; tT += ws.length
    console.log(`## ${tema}  (${ws.length} candidatas)`)
    console.log(`  PORTABLE libre en lista B1 (${dentro.length}): ${dentro.join(', ')}`)
    console.log(`  ANCLA libre fuera de lista (${fuera.length}): ${fuera.join(', ')}`)
    console.log(`  OCUPADA por otro journey ES (${ocup.length}): ${ocup.map(w=>`${w}<-${taken.get(w.toLowerCase())}`).join(', ') || '-'}\n`)
  }
  console.log(`TOTAL: ${tT} candidatas · portable libre ${tD} · ancla libre ${tF} · ocupada ${tO}`)
}
main().finally(()=>p.$disconnect())
