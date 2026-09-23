/**
 * Nombres que la voz de TTS no sabe decir dos veces igual.
 *
 * POR QUE EXISTE (2026-09-23, Friends ES Mexico A0). El reparto llevaba
 * "Itzel", nombre maya, de personaje recurrente. Paso TODOS los gates: esta en
 * el banco `spanish/mexico` de `characterNames.ts`, es un nombre real, comun en
 * Mexico y de la generacion correcta. Y aun asi rompio el audio del journey
 * entero:
 *
 *   - 74 apariciones en 20 de las 21 historias.
 *   - Duracion de 0,12 s a 0,96 s, casi ocho veces, para la misma palabra.
 *   - Tres reconocedores escribieron "Ixchel", "Excel" y "Chelsea".
 *   - De 21 candidatas llevadas al oido del usuario, 12 salieron mal.
 *
 * Lo oyo el usuario, no un gate: los tres candados de narracion miran
 * entonacion, contenido y cobertura, y ninguno mira si un nombre suena igual
 * dos veces. Y el fallo solo aparece con el journey ya narrado, que es la fase
 * mas cara y la ultima. Palabras del usuario: "no nombres raros, regla dura,
 * muy dura. Las voces solo saben pronunciar nombres comunes para sus idiomas".
 *
 * QUE MIRA. No "es raro" ni "es indigena", que no son medibles desde una
 * cadena. Mira GRUPOS DE LETRAS ajenos a la ortografia normal del idioma, que
 * es lo que deja a la voz sin una pronunciacion aprendida y la hace improvisar
 * distinto cada vez. En espanol, los dos que importan vienen del nahuatl y del
 * maya: `tz` (Itzel, Quetzal) y `tl` (Citlali, Xochitl). "Ximena" NO cae aqui,
 * y hace bien: su `x` se lee como la jota castellana, que la voz tiene
 * aprendida de "Mexico" y "Javier".
 *
 * ES UNA HEURISTICA, no una prueba. La prueba de verdad es sintetizar UNA linea
 * con el nombre y oirla, que cuesta unos pocos caracteres frente a las decenas
 * de miles de un journey narrado. Este gate solo asegura que nadie llegue a la
 * fase de audio sin haberla hecho.
 *
 * Ver `feedback_tts_only_says_common_names` y `project_character_name_rules`.
 */

/** Grupos de letras que dejan a la voz sin pronunciacion aprendida. */
const GRUPOS_DIFICILES: Record<string, { re: RegExp; porque: string }[]> = {
  spanish: [
    { re: /tz/i, porque: "el grupo \"tz\" no es del espanol; viene del nahuatl y del maya" },
    { re: /tl/i, porque: "el grupo \"tl\" no es del espanol; viene del nahuatl" },
  ],
  portuguese: [
    { re: /tz/i, porque: "el grupo \"tz\" no es del portugues" },
    { re: /tl/i, porque: "el grupo \"tl\" no es del portugues" },
  ],
  italian: [
    { re: /(kh|tsch)/i, porque: "grupo ajeno a la ortografia italiana" },
  ],
  french: [
    { re: /(tz|kh)/i, porque: "grupo ajeno a la ortografia francesa" },
  ],
  german: [
    { re: /(sch(?=[^aeiouAEIOU])|kh)/i, porque: "grupo ajeno a la ortografia alemana" },
  ],
};

export type NombreDificil = { nombre: string; porque: string };

/**
 * Los nombres del reparto que la voz probablemente no sabe decir.
 * `aprobados` son los que el usuario ya oyo y dio por buenos.
 */
export function nombresDificiles(
  nombres: Iterable<string>,
  language: string | null | undefined,
  aprobados: Iterable<string> = [],
): NombreDificil[] {
  const reglas = GRUPOS_DIFICILES[String(language ?? "").trim().toLowerCase()];
  if (!reglas) return [];
  const ok = new Set([...aprobados].map((n) => n.toLowerCase()));
  const vistos = new Set<string>();
  const fuera: NombreDificil[] = [];
  for (const n of nombres) {
    const clave = n.toLowerCase();
    if (ok.has(clave) || vistos.has(clave)) continue;
    const regla = reglas.find((r) => r.re.test(n));
    if (!regla) continue;
    vistos.add(clave);
    fuera.push({ nombre: n, porque: regla.porque });
  }
  return fuera;
}

/**
 * Nombres que el usuario ya aprobo de oido para este idioma, con la fecha.
 * Solo crece cuando el usuario lo dice: es la contrapartida del gate, igual que
 * la lista de voces aprobadas.
 */
export const NOMBRES_APROBADOS_DE_OIDO: Record<string, string[]> = {
  spanish: [],
};
