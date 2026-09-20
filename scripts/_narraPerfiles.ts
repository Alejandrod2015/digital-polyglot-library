/**
 * Perfiles de narracion (journey, mapa de voces, bundle de glosas) y las dos
 * reglas que comparten la muestra (_muestraA2Titulo.ts), el runner
 * (_narraUnaA2.ts) y el modo en seco (_narraSeco.ts): con que voz se narra cada
 * historia, y en que paso del orden de narracion por tema esta. Aqui no se
 * sintetiza nada, y por eso el modo en seco puede importarlo sin tocar el guard
 * de audio.
 *
 * b2-latam (2026-09-11): su voiceId se escribio ANTES de narrar
 * (scripts/_b2/_asignaVoces.ts, desde VOZ_POR_TEMA_B2_LATAM). En ese perfil la
 * voz guardada manda y el mapa solo la confirma: si discrepan, se para en vez
 * de narrar con una de las dos. Los perfiles a2 y b1-latam siguen igual: la voz
 * sale del mapa y el runner la escribe al narrar.
 */
import * as fs from "fs";
import * as path from "path";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import { assertNarradorPermitido } from "../src/lib/bannedNarrators";
import { VOZ_POR_TEMA } from "./_a2Voces";
import { VOZ_POR_TEMA_B1_LATAM } from "./_b1LatamVoces";
import { VOZ_POR_TEMA_B2_LATAM } from "./_b2LatamVoces";
import { VOZ_POR_TEMA_FR_A0 } from "./_frA0Voces";
import { VOZ_POR_TEMA_FR_A2 } from "./_frA2Voces";
import { VOZ_POR_TEMA_FR_B1 } from "./_frB1Voces";
import { VOZ_POR_TEMA_DE_A1_FRIENDS } from "./_deA1FriendsVoces";
import { VOZ_POR_TEMA_DE_A0_FRIENDS } from "./_deA0FriendsVoces";
import { VOZ_POR_TEMA_IT_A0_FRIENDS } from "./_itA0FriendsVoces";
import { VOZ_POR_TEMA_ES_A2_FRIENDS } from "./_esA2FriendsVoces";
import { VOZ_POR_TEMA_ES_A0_CULTURAL } from "./_esA0CulturalVoces";

export type Perfil = {
  journey: string;
  voces: Record<string, string>;
  bundle: string;
  language?: string;
  vozGuardadaManda?: boolean;
};

export const PERFILES: Record<string, Perfil> = {
  a2: { journey: "cmtgelq560007j84n3ujx9bpd", voces: VOZ_POR_TEMA, bundle: "spanish-traveler-latam-a2" },
  "b1-latam": { journey: "cmtmylg7k0007321h6t7njesx", voces: VOZ_POR_TEMA_B1_LATAM, bundle: "spanish-traveler-latam-b1" },
  "b2-latam": {
    journey: "cmtpls1l20007j8epwgcs6e1h",
    voces: VOZ_POR_TEMA_B2_LATAM,
    bundle: "spanish-traveler-latam-b2",
    vozGuardadaManda: true,
  },
  // Perfiles portados el 2026-09-17 de la version inline (pre-refactor) de
  // _muestraA2Titulo.ts, cuando esta rama traia _narraPerfiles.ts como modulo
  // compartido. Mismos journeys y mapas de voces; bundle deducido del nombre
  // que usan rebuildTapGlosses.ts / tap-gloss-exempt.json para cada uno.
  "fr-a0": { journey: "cmtwo6cys0007j8yzg6ni3fsc", voces: VOZ_POR_TEMA_FR_A0, bundle: "french-friends-a0" },
  "fr-a2-friends": { journey: "cmu04ereh000732z7px7naqa2", voces: VOZ_POR_TEMA_FR_A2, bundle: "french-friends-france-a2", language: "french" },
  "fr-b1-friends": { journey: "cmu0doigc0007j8e292tycths", voces: VOZ_POR_TEMA_FR_B1, bundle: "french-friends-france-b1", language: "french" },
  "de-a1-friends": { journey: "cmu0dqr6y0007j8o52i1s3gf7", voces: VOZ_POR_TEMA_DE_A1_FRIENDS, bundle: "german-friends-a1", language: "german" },
  "de-a0-friends": { journey: "cmu047bkz0007326jsgeptkox", voces: VOZ_POR_TEMA_DE_A0_FRIENDS, bundle: "german-friends-a0", language: "german" },
  "it-a0-friends": { journey: "cmu0dpa3i0007j80ugstn0jf0", voces: VOZ_POR_TEMA_IT_A0_FRIENDS, bundle: "italian-friends-italy-a0", language: "italian" },
  "es-a2-friends": { journey: "cmu36dk1d0007j8p7grgcyiok", voces: VOZ_POR_TEMA_ES_A2_FRIENDS, bundle: "spanish-friends-spain-a2", language: "spanish" },
  "es-a0-cultural": { journey: "cmu410zep000732szrw94t2sl", voces: VOZ_POR_TEMA_ES_A0_CULTURAL, bundle: "spanish-cultural-latam-a0", language: "spanish" },
};

export function perfilDeArgs(argv: string[]): Perfil {
  const i = argv.indexOf("--journey");
  const nombre = i >= 0 ? argv[i + 1] : "a2";
  const perfil = PERFILES[nombre];
  if (!perfil) throw new Error(`perfil desconocido "${nombre}"; usa --journey ${Object.keys(PERFILES).join(" | ")}`);
  return perfil;
}

/** La voz con la que se narra la historia. Tira si no hay, si la guardada y la
 *  del mapa no coinciden (en los perfiles donde manda la guardada), si la voz no
 *  esta aprobada o si esta vetada como narrador. */
export function vozDe(perfil: Perfil, s: { slug: string | null; topic: string; voiceId?: string | null }): string {
  const delMapa = perfil.voces[s.topic];
  if (!delMapa) throw new Error(`sin narrador para el tema ${s.topic}`);
  let voz = delMapa;
  if (perfil.vozGuardadaManda) {
    if (!s.voiceId) throw new Error(`${s.slug} no tiene voiceId guardado, y este perfil no lo asigna al narrar`);
    if (s.voiceId !== delMapa) throw new Error(`${s.slug}: la voz guardada (${s.voiceId}) no es la del mapa (${delMapa})`);
    voz = s.voiceId;
  }
  assertVoiceApproved(voz, `narracion:${s.slug}`);
  assertNarradorPermitido(voz, `narracion:${s.slug}`);
  return voz;
}

export const REGISTRO_MUESTRAS = path.join(__dirname, "a2-muestras.json");

export function muestrasRegistradas(): Record<string, unknown> {
  return fs.existsSync(REGISTRO_MUESTRAS)
    ? (JSON.parse(fs.readFileSync(REGISTRO_MUESTRAS, "utf8")) as Record<string, unknown>)
    : {};
}

/** ORDEN DE NARRACION POR TEMA (regla dura, 2026-09-02): primero la muestra de
 *  titulo y primer parrafo, que el usuario comprueba; luego la primera historia
 *  entera, que vuelve a comprobar; y solo entonces el resto del tema.
 *  `bloqueo` dice por que la historia todavia no puede narrarse entera. */
export function pasoDelOrden(
  s: { slug: string | null; slotIndex: number; audioUrl?: string | null },
  muestras: Record<string, unknown>,
  primeraDelTemaNarrada: boolean,
): { paso: "ya narrada" | "muestra" | "primera entera" | "resto del tema"; bloqueo?: string } {
  if (s.audioUrl) return { paso: "ya narrada" };
  if (s.slotIndex === 1) {
    return muestras[s.slug ?? ""]
      ? { paso: "primera entera" }
      : { paso: "muestra", bloqueo: "es la PRIMERA de su tema y no tiene muestra" };
  }
  return primeraDelTemaNarrada
    ? { paso: "resto del tema" }
    : { paso: "resto del tema", bloqueo: "la primera de este tema todavia no esta narrada" };
}
