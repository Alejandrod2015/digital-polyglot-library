/** Narrador por tema del B1 Traveler latam: el del PAIS DE LA ESCENA, la misma
 *  convencion del A0, A1 y A2 latam, y SOLO voces ya aprobadas.
 *
 *  Paises medidos en el primer parrafo de la primera historia de cada tema
 *  (2026-09-07). animals-and-farms pasa en Chiloe, Chile.
 *
 *  El 2026-09-09 esta fila estuvo vacia con la nota "no hay voz chilena
 *  aprobada", y era FALSO: habia tres. Las notas de approvedVoices.ts no dicen
 *  el pais de seis entradas ("Traveler LATAM voice (published)"), asi que el
 *  dato solo esta en la ficha de la cuenta. El usuario escogio a Rodrigo de
 *  oido y veto a Narrator CL - Carlos (ver src/lib/bannedNarrators.ts). */
export const VOZ_POR_TEMA_B1_LATAM: Record<string, string> = {
  "promises-and-excuses": "MjtZn5tagxL1RO6w9ER5",   // Lionel, AR (Mendoza)
  "advice-and-opinions": "yHD4CsKkghm19ToGLJEC",    // Hernando, CO (Manizales)
  "faith-and-devotion": "ulJB4yAMefhHYn0FWgGy",     // Terry, PE (Ayacucho)
  "animals-and-farms": "yytxkT3pNVMWDHn3KXrY",      // Rodrigo, CL (Chiloe)
  "games-and-bets": "JW8DGEuLp9WxIS5IdxMM",         // Andreti, MX (Aguascalientes)
  "pride-and-envy": "MjtZn5tagxL1RO6w9ER5",         // Lionel, AR (Tucuman)
  "distance-and-homecoming": "yHD4CsKkghm19ToGLJEC",// Hernando, CO (Popayan)
};
