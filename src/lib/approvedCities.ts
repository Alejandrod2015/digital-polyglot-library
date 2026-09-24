/**
 * CIUDADES APROBADAS, por idioma.
 *
 * Regla dura del usuario (2026-09-24), literal: "Las ciudades de los journeys
 * tienen que ser ciudades muy conocidas fuera de esos países, principalmente
 * por nuestro grupo objetivo, anglosajones."
 *
 * El lector es anglosajon: una ciudad que no reconoce no le dice nada, ni en la
 * tienda, ni en la portada, ni dentro de la historia. Lo que se mide es la
 * ciudad que ENMARCA el journey. Los barrios y los sitios concretos de dentro
 * de las historias siguen siendo pequenos y especificos, y no pasan por aqui:
 * el Friends FR A0 se enmarca en Marsella y vive en una placita del Panier, y
 * eso esta bien.
 *
 * COMO SE SIEMBRA ESTA LISTA (y por que es tan corta). Lleva exactamente las
 * ciudades de los journeys que YA cumplian la regla el 2026-09-24, medidas una
 * a una sobre el texto (docs/auditoria-ciudades-journeys-2026-09-24.md). Ni una
 * mas. Que Sevilla o Napoli falten no es un olvido: es que nadie las ha
 * aprobado todavia, y la lista no se rellena a ojo "porque obviamente valen".
 *
 * COMO SE AMPLIA. Igual que la allowlist de voces (`approvedVoices.ts`): la
 * anade el USUARIO, o Claude despues de que el usuario lo diga en el chat.
 * Claude NO agrega una ciudad por su cuenta para que le pase su propio journey,
 * que es exactamente el fallo que la lista existe para impedir.
 *
 * LO QUE ESTA LISTA NO DICE. No dice que una ciudad ausente sea mala: dice que
 * nadie la ha aprobado. Y no sirve para juzgar los journeys ya escritos, que se
 * miden con la auditoria; sirve para el momento en que se fija un journey
 * NUEVO, antes del primer tema.
 */

/** Ciudades aprobadas por idioma. La clave es `Journey.language`. */
export const APPROVED_CITIES: Record<string, string[]> = {
  french: ["Paris", "Marseille"],
  german: ["Berlin", "Hamburg", "Frankfurt", "Munich"],
  italian: ["Milan"],
  spanish: ["Madrid", "Buenos Aires", "Guadalajara", "Santiago de Compostela", "Medellin"],
  portuguese: ["Brasilia"],
  korean: ["Seul"],
  polish: ["Krakow"],
  arabic: ["El Cairo"],
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export class CityNotApprovedError extends Error {}

/**
 * Las ciudades aprobadas de un idioma. La clave se busca sin distinguir
 * mayusculas porque `Journey.language` las guarda en minuscula ("french") y las
 * llamadas sueltas escriben "French".
 */
export function approvedCitiesFor(language: string): string[] {
  const k = Object.keys(APPROVED_CITIES).find((x) => x.toLowerCase() === language.toLowerCase());
  return k ? APPROVED_CITIES[k] : [];
}

/** true si esa ciudad esta aprobada para ese idioma. Acentos y mayusculas dan igual. */
export function isCityApproved(language: string, city: string): boolean {
  return approvedCitiesFor(language).some((c) => norm(c) === norm(city));
}

/**
 * Tira si la ciudad marco no esta aprobada para ese idioma. Se llama ANTES de
 * fijar los siete temas, que es cuando la decision todavia es gratis: despues,
 * la ciudad ya esta pagada en 21 briefs y en los prompts de portada, y tres de
 * los journeys que incumplian el 2026-09-24 estaban ademas publicados y
 * narrados, o sea que cambiarla se paga en resintesis.
 */
export function assertCityApproved(language: string, city: string): void {
  if (isCityApproved(language, city)) return;
  const lista = approvedCitiesFor(language);
  throw new CityNotApprovedError(
    `CIUDAD NO APROBADA: "${city}" (${language}).\n` +
    `La ciudad que enmarca un journey tiene que ser reconocible FUERA de su pais ` +
    `por un anglosajon (regla del usuario, 2026-09-24).\n` +
    `Aprobadas hoy en ${language}: ${lista.length ? lista.join(" · ") : "(ninguna)"}.\n` +
    `Si esta ciudad tiene que entrar, la aprueba el USUARIO en el chat; no la ` +
    `agregues tu a src/lib/approvedCities.ts.`,
  );
}
