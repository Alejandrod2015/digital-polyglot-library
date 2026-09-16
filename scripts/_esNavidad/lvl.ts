import { isSpanishUpToLevel } from '../../src/lib/cefr/spanishLevels'
const CAND: Record<string, string[]> = {
  'ancla navidena (mexicana)': ['posada','pinata','colacion','ponche','tejocote','cana','aguinaldo','villancico','peregrino','letania','nacimiento','pesebre','nochebuena','pavo','bacalao','romeritos','recalentado','brindis','uva','proposito','cohete','esfera','adorno','heno','musgo','rosca','muneco','corona','tamal','atole','candelaria','compadre','padrino','arrullar','vela','farol','peregrinacion','alcancia','ofrenda','mole','pozole','buñuelo','sidra','guirnalda','nochebuena','noche buena','reyes magos','nino dios','cena de navidad','pastorela','misa de gallo','ano nuevo'],
  'campo domestico / familiar': ['cena','familia','regalo','fiesta','invitar','cocinar','vecino','casa','patio','mesa','plato','olla','receta','sabor','dulce','caliente','frio','abrazo','cantar','bailar','rezar','iglesia','calle','barrio','mercado','pedir','repartir','compartir','prestar','deber','ahorrar','gastar','sueldo','deuda','prometer','discutir','perdonar','extranar','recordar','esperar','llegar','tarde','temprano','juntos','solo','ruido','silencio','luz','apagar','encender'],
  'verbos / adjetivos de arco': ['organizar','encargar','cancelar','sobrar','faltar','alcanzar','romper','arreglar','decidir','elegir','fingir','confesar','enojarse','avergonzarse','orgulloso','nervioso','cansado','emocionado','vacio','lleno','barato','caro','justo','injusto','pesado','ligero'],
}
for (const level of ['a1','a2','b1','b2'] as const) {
  console.log(`\n######## NIVEL ${level.toUpperCase()} ########`)
  for (const [grupo, ws] of Object.entries(CAND)) {
    const inList = ws.filter(w => isSpanishUpToLevel(w, level))
    const out = ws.filter(w => !isSpanishUpToLevel(w, level))
    console.log(`\n-- ${grupo}: ${inList.length}/${ws.length} en lista`)
    console.log(`   DENTRO: ${inList.join(', ')}`)
    console.log(`   FUERA : ${out.join(', ')}`)
  }
}
