// ¿Puede el selector de la app ENCONTRAR un journey con esta variante?
//
// POR QUÉ EXISTE (2026-08-14):
//   El selector de idiomas ofrece códigos cortos ("br", "es", "pt") y Studio
//   persiste el nombre del país ("brazil", "spain", "portugal"). Los dos lados
//   se comparan pasando por `regionFamily`, que pliega los equivalentes. Si a
//   una variante le falta su familia, los dos valores no casan NUNCA y el
//   journey desaparece del paso 2 sin error, sin log y sin aviso: la pantalla
//   dice "No journeys available for X yet", indistinguible de no tener
//   contenido. Le pasó al portugués de Brasil, publicado y servido, invisible
//   durante una tarde entera.
//
//   Este módulo lee la verdad de los DOS archivos del cliente en vez de
//   copiarla, para que no se quede viejo cuando alguien añada una variante.

import { readFileSync } from "fs";

const FLAG_FILE = "apps/mobile/src/mobile/LanguageFlag.tsx";
const PANEL_FILE = "apps/mobile/src/mobile/JourneysPanel.tsx";

function readSet(src: string, name: string): Set<string> {
  const m = src.match(new RegExp(`const ${name} = new Set<string>\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) throw new Error(`No encuentro ${name} en ${FLAG_FILE}. ¿Se renombró?`);
  return new Set(Array.from(m[1].matchAll(/"([^"]+)"/g)).map((x) => x[1]));
}

/** Las familias tal y como las define el cliente, en su mismo orden. */
function loadFamilies(): Array<[Set<string>, string]> {
  const src = readFileSync(FLAG_FILE, "utf8");
  // El orden importa: `regionFamily` devuelve la PRIMERA que coincide.
  const nombres: Array<[string, string]> = [
    ["LATAM_REGION_CODES", "latam"],
    ["SPAIN_REGION_CODES", "spain"],
    ["UK_REGION_CODES", "uk"],
    ["PORTUGAL_REGION_CODES", "pt"],
    ["BRAZIL_REGION_CODES", "brazil"],
  ];
  return nombres.map(([n, fam]) => [readSet(src, n), fam]);
}

/** Copia fiel de `regionFamily` del cliente, alimentada por sus propios sets. */
export function regionFamily(code: string | null | undefined): string {
  const v = (code ?? "").trim().toLowerCase();
  if (!v) return "";
  for (const [set, fam] of loadFamilies()) if (set.has(v)) return fam;
  return v;
}

export type SelectorOption = { name: string; variant: string | null };

/** Las opciones que el selector de la app ofrece de verdad. */
export function loadSelectorOptions(): SelectorOption[] {
  const panel = readFileSync(PANEL_FILE, "utf8");
  return Array.from(
    panel.matchAll(/\{ key: "[^"]+", name: "([^"]+)", variant: (?:"([^"]+)"|null)/g)
  ).map((m) => ({ name: m[1], variant: m[2] ?? null }));
}

export type VariantCheck = {
  ok: boolean;
  /** La opción del selector que lo encuentra, si la hay. */
  match: SelectorOption | null;
  /** Variantes que el selector ofrece para ese idioma, para el mensaje. */
  offered: Array<string | null>;
  reason: string;
};

/**
 * ¿Encontraría el selector un journey de este idioma y variante?
 *
 * Una opción SIN variante no filtra nada y ve todos los journeys de su idioma;
 * solo las opciones con variante comparan familias. Ese matiz es el que
 * distingue "alemán está bien" de "Brasil está roto".
 */
export function checkSelectorFindsVariant(language: string, variant: string | null): VariantCheck {
  const options = loadSelectorOptions();
  const forLanguage = options.filter((o) => o.name.toLowerCase() === language.trim().toLowerCase());
  const offered = forLanguage.map((o) => o.variant);

  if (forLanguage.length === 0) {
    return {
      ok: false,
      match: null,
      offered,
      reason: `El selector no ofrece el idioma "${language}". Añádelo a LANGUAGE_OPTIONS en ${PANEL_FILE}.`,
    };
  }

  const match =
    forLanguage.find((o) => o.variant === null) ??
    forLanguage.find((o) => regionFamily(o.variant) === regionFamily(variant)) ??
    null;

  if (match) {
    return {
      ok: true,
      match,
      offered,
      reason:
        match.variant === null
          ? "la opción del selector no tiene variante, así que ve todos los journeys de su idioma"
          : `"${match.variant}" y "${variant}" caen en la familia "${regionFamily(variant)}"`,
    };
  }

  return {
    ok: false,
    match: null,
    offered,
    reason:
      `El selector ofrece ${offered.map((v) => `"${v}"`).join(", ")} para ${language}, y ninguna cae en la ` +
      `misma familia que "${variant}" (familia "${regionFamily(variant)}"). El journey NO aparecerá en el ` +
      `paso 2, y no dará ningún error: la pantalla dirá "No journeys available". Arréglalo añadiendo "${variant}" ` +
      `a la familia que corresponda en ${FLAG_FILE}.`,
  };
}
