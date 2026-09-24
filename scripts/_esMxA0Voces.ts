/** Narrador del Friends ES Mexico A0 (Guadalajara): Andreti, uno solo para los
 *  siete temas. Es la voz de Mexico del catalogo, no una eleccion nueva: ya
 *  narra las seis historias mexicanas del Cultural latam A0 (day-of-the-dead y
 *  valentines-and-romance) y entra aqui por continuidad de pais
 *  (feedback_voice_matches_country), decidido por el usuario el 2026-09-23.
 *
 *  Journey de narrador unico: las 21 historias van en tercera persona con
 *  dialogo citado, y esa misma voz lee la prosa y el dialogo.
 *
 *  Cuidado si se busca la voz de Mexico por el fichero de aprobadas: la nota de
 *  Andreti en approvedVoices.ts dice "Friends/Traveler LATAM narrator" y su
 *  etiqueta en ElevenLabs es "latin american", sin pais. El pais vive aqui, en
 *  los mapas de voces, que es donde hay que mirar.
 */
const ANDRETI = "JW8DGEuLp9WxIS5IdxMM";

export const VOZ_POR_TEMA_ES_MX_A0: Record<string, string> = {
  "rooftops-and-laundry": ANDRETI,
  "haircuts-and-barbershops": ANDRETI,
  "plants-and-balconies": ANDRETI,
  "lost-and-found": ANDRETI,
  "wrestling-and-masks": ANDRETI,
  "grills-and-backyards": ANDRETI,
  "parcels-and-deliveries": ANDRETI,
};
