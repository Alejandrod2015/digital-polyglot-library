/** Narrador por tema del B1 Traveler latam: el del PAIS DE LA ESCENA, la misma
 *  convencion del A0, A1 y A2 latam, y SOLO voces ya aprobadas.
 *
 *  Paises medidos en el primer parrafo de la primera historia de cada tema
 *  (2026-09-07). animals-and-farms pasa en Chiloe, Chile, y NO hay voz chilena
 *  en la allowlist: queda sin fila a proposito para que la muestra de ese tema
 *  FALLE en seco hasta que el usuario apruebe una de oido; no se disimula con
 *  un acento vecino sin decirlo. */
export const VOZ_POR_TEMA_B1_LATAM: Record<string, string> = {
  "promises-and-excuses": "MjtZn5tagxL1RO6w9ER5",   // Lionel, AR (Mendoza)
  "advice-and-opinions": "yHD4CsKkghm19ToGLJEC",    // Hernando, CO (Manizales)
  "faith-and-devotion": "ulJB4yAMefhHYn0FWgGy",     // Terry, PE (Ayacucho)
  // "animals-and-farms": PENDIENTE DE AUDICION      // Chile (Chiloe), sin voz aprobada
  "games-and-bets": "JW8DGEuLp9WxIS5IdxMM",         // Andreti, MX (Aguascalientes)
  "pride-and-envy": "MjtZn5tagxL1RO6w9ER5",         // Lionel, AR (Tucuman)
  "distance-and-homecoming": "yHD4CsKkghm19ToGLJEC",// Hernando, CO (Popayan)
};
