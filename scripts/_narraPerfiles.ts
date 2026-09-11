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

export type Perfil = {
  journey: string;
  voces: Record<string, string>;
  bundle: string;
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
  // spain-b1 (2026-09-11): narradora unica, Maia, en los siete temas, igual que
  // el A1 y el A2 de Espana. Su voiceId ya esta guardado en las 21, asi que manda
  // la guardada y el mapa la confirma.
  "spain-b1": {
    journey: "cmt5x67ze000l320cpgunu5vi",
    voces: Object.fromEntries(
      ["rooms-and-landlords", "jobs-and-wages", "meetings-and-deadlines", "repeating-and-rephrasing",
        "sayings-and-nicknames", "deals-and-estimates", "trust-and-rumours"].map((t) => [t, "jipeLrCHZ6ByxrU2JP9i"]),
    ),
    bundle: "spanish-traveler-spain-b1",
    vozGuardadaManda: true,
  },
  // spain-b2 (2026-09-11): narradora unica, Maia, en los siete temas, igual que
  // el A1, el A2 y el B1 de Espana. Su voiceId ya esta guardado en las 21
  // (scripts/_b2s/_ponVozNarradora.ts), asi que manda la guardada y el mapa la
  // confirma.
  "spain-b2": {
    journey: "cmtplpfum0007j8c6piegwt31",
    voces: Object.fromEntries(
      ["locals-and-outsiders", "humour-and-comebacks", "rounds-and-regulars", "news-and-headlines",
        "wind-and-plans", "books-and-bookshops", "visits-and-old-friends"].map((t) => [t, "jipeLrCHZ6ByxrU2JP9i"]),
    ),
    bundle: "spanish-traveler-spain-b2",
    vozGuardadaManda: true,
  },
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
