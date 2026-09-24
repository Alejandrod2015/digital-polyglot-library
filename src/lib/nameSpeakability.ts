/**
 * Nombres que la voz de TTS no sabe decir, porque no son de su idioma.
 *
 * POR QUE EXISTE (2026-09-23, Friends ES Mexico A0). El reparto llevaba
 * "Itzel", nombre maya, de personaje recurrente. Paso TODOS los gates que
 * habia: esta en el banco `spanish/mexico`, se usa en Mexico, y es de la
 * generacion correcta. Y aun asi rompio el audio del journey entero:
 *
 *   - 72 apariciones en 18 de las 21 historias.
 *   - Duracion de 0,12 s a 0,96 s, casi ocho veces, para la misma palabra.
 *   - Tres reconocedores escribieron "Ixchel", "Excel" y "Chelsea".
 *   - De 21 candidatas llevadas al oido del usuario, 12 salieron mal.
 *
 * Lo oyo el usuario, no un gate: los tres candados de narracion miran
 * entonacion, contenido y cobertura, y ninguno mira si un nombre suena igual
 * dos veces. Y el fallo solo aparece con el journey ya narrado, que es la fase
 * mas cara y la ultima. Palabras del usuario: "Las voces solo saben pronunciar
 * nombres comunes para sus idiomas".
 *
 * QUE MIDE, y que NO. La regla es el ORIGEN del nombre, no como se escribe.
 * El primer intento buscaba grupos de letras ajenos (`tz`, `tl` en espanol);
 * acertaba con Itzel y Citlali por casualidad, y en el resto del catalogo era
 * ruido: la version para aleman marco 104 palabras corrientes, Schwester y
 * Waschmaschine entre ellas. Lo que decide es si el nombre pertenece a la
 * lengua del journey, y de eso ya hay una lista por idioma y region: el banco
 * de `characterNames.ts`. Fuera del banco, no entra.
 *
 * Se aplica al REPARTO (`castOf`: quien habla en dos historias o mas), no a
 * toda mayuscula del texto. Un toponimo como Tlaquepaque o una fiesta como la
 * Guelaguetza salen una vez en boca del narrador y no son el problema que esto
 * resuelve.
 *
 * Ver `feedback_tts_only_says_common_names` y `project_character_name_rules`.
 */
import type { NameBank } from "@/lib/characterNames";

/**
 * Nombres que el usuario ya aprobo DE OIDO para un idioma, oyendo una linea con
 * ese nombre en la voz del journey. Solo crece cuando el usuario lo dice, igual
 * que la lista de voces aprobadas.
 */
export const NOMBRES_APROBADOS_DE_OIDO: Record<string, string[]> = {
  spanish: [],
};

/** Los del reparto que no son de la lengua del journey ni estan aprobados. */
export function fueraDelIdioma(
  cast: Iterable<string>,
  bank: NameBank,
  language: string | null | undefined,
): string[] {
  const aprobados = NOMBRES_APROBADOS_DE_OIDO[String(language ?? "").trim().toLowerCase()] ?? [];
  const permitidos = new Set(
    [...bank.young, ...bank.older, ...aprobados].map((n) => n.trim().toLowerCase()),
  );
  const fuera: string[] = [];
  const vistos = new Set<string>();
  for (const n of cast) {
    const clave = n.trim().toLowerCase();
    if (!clave || permitidos.has(clave) || vistos.has(clave)) continue;
    vistos.add(clave);
    fuera.push(n);
  }
  return fuera;
}
