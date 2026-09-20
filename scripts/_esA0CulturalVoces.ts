/** Narrador por tema del Cultural ES latam A0 (Alondra y Ulises recorren siete
 *  fiestas, una por pais): el del PAIS DE LA FIESTA, como en el A2 y el B1
 *  latam. Aceptado por el planificador y el usuario el 2026-09-20 sobre la
 *  tabla tema > pais > voz (ver SendMessage a Journey-planning-2).
 *
 *  Colombia y Mexico reusan la voz que ya narra el resto del catalogo latam
 *  para esos paises (Hernando, Andreti); Peru usa Terry, la unica candidata
 *  aprobada que el usuario no ha vetado (Giancarlos quedo descartado en
 *  project_peru_voice_bank).
 */
export const VOZ_POR_TEMA_ES_A0_CULTURAL: Record<string, string> = {
  "carnival-and-parades": "yHD4CsKkghm19ToGLJEC",    // Hernando, CO (Barranquilla)
  "valentines-and-romance": "JW8DGEuLp9WxIS5IdxMM",  // Andreti, MX (Ciudad de Mexico)
  "easter-and-processions": "ulJB4yAMefhHYn0FWgGy",  // Terry, PE (Ayacucho)
  "solstice-and-sun": "ulJB4yAMefhHYn0FWgGy",        // Terry, PE (Cusco)
  "day-of-the-dead": "JW8DGEuLp9WxIS5IdxMM",         // Andreti, MX (Oaxaca)
  "christmas-and-posadas": "JW8DGEuLp9WxIS5IdxMM",   // Andreti, MX (Ciudad de Mexico)
  "new-year-and-goodbyes": "yHD4CsKkghm19ToGLJEC",   // Hernando, CO (Medellin)
};
