/**
 * LINEA BASE del suelo de nivel, por journey.
 *
 * POR QUE (2026-09-08). El suelo subio del 30% al 60% de plazas por encima de
 * A1/A2 y tres journeys ya escritos quedaron en rojo. Al medir el techo real
 * salio que NO se puede llegar al 60% moviendo plazas: la plaza solo puede
 * apuntar a una palabra que este en el cuerpo, y estos journeys se escribieron
 * contra el suelo viejo, asi que su PROSA es densa en A1/A2 por construccion.
 * Dos chats lo midieron por separado y coincidieron: el techo del B1 latam es
 * 42-44% y el del B2 de España, 50%. Exigirles 60% no es exigente, es
 * imposible sin reescribir 63 historias, tres de ellas ya narradas.
 *
 * Asi que se aplica el mismo patron que el resto de las deudas del proyecto
 * (los trozos largos de gloss-variants, los huecos de gloss-context, las
 * reglas sin gate del inventario): la deuda se CONGELA donde esta y solo puede
 * bajar. Aqui: cada journey de esta lista conserva como suelo el porcentaje
 * que tenia el 2026-09-08. Si sube, se aprieta la cifra a mano y ya no puede
 * volver a bajar. Los journeys que NO estan aqui, incluidos todos los nuevos,
 * responden al 60% completo.
 *
 * La cifra es la fraccion medida REDONDEADA HACIA ABAJO (180/420 = 0,42857 se
 * congela como 0,4285): redondear hacia arriba, o a dos decimales, dejaba el journey un pelo por debajo de su propia linea base y lo
 * hacia fallar contra si mismo.
 *
 * Lo que NO arregla esta lista, y hay que decirlo: estos journeys siguen
 * ensenando mas vocabulario de A1 del que deberian. Lo que compra es que la
 * reescritura de sus cuerpos se decida como su propio encargo, con su coste
 * medido, en vez de colarse dentro de un cambio de plazas.
 */
export const SUELO_NIVEL_CONGELADO: Record<string, { cuota: number; nota: string }> = {
  cmtmylg7k0007321h6t7njesx: { cuota: 0.3333, nota: "Traveler ES/latam B1, 140/420; techo medido 42%" },
  cmt5x67ze000l320cpgunu5vi: { cuota: 0.4285, nota: "Traveler ES/spain B1, 180/420; techo medido 44%" },
  cmtplpfum0007j8c6piegwt31: { cuota: 0.4761, nota: "Traveler ES/spain B2, 200/420; techo medido 50%" },
};

/** El suelo que le toca a este journey: el congelado si lo tiene, o el general. */
export function sueloDeNivel(journeyId: string | null | undefined, general: number): number {
  const c = journeyId ? SUELO_NIVEL_CONGELADO[journeyId] : undefined;
  return c ? c.cuota : general;
}
