/**
 * Marcadores gramaticales que mide la sonda de nivel (`scripts/_gramProbe.ts`).
 *
 * Viven aqui, y no dentro del script, por dos motivos: para poder probarlos sin
 * arrastrar Prisma ni dotenv, y para que la revision token a token de las
 * marcas lea ESTAS expresiones en vez de una copia que se desincronice.
 *
 * FRONTERAS: `\b` de JavaScript se define sobre `\w`, que es ASCII, asi que una
 * vocal acentuada NO es caracter de palabra y ABRE frontera donde no la hay.
 * Con `\b[a-za-u]+(o|aron|ieron)\b` la marca de preterito casaba dentro de
 * "galpon" y de "decepcion", que no son verbos. Medido el 2026-09-16 sobre el
 * tema 2 del Cultural ES/LATAM: 3 de 10 marcas de preterito eran de ese tipo, y
 * la cifra salia 18 por 100 oraciones en vez de 13. Por eso las fronteras van
 * con lookaround sobre `\p{L}` y todas las expresiones llevan la bandera `u`.
 */

/** Frontera izquierda: no hay letra justo antes. */
const B = "(?<!\\p{L})";
/** Frontera derecha: no hay letra justo despues. */
const E = "(?!\\p{L})";

const re = (src: string) => new RegExp(src, "giu");

export const RE: Array<[string, RegExp]> = [
  ["pretérito", re(`${B}[a-zá-úñ]+(ó|aron|ieron)${E}|${B}(fue|fueron|tuvo|hizo|dijo|vino|dio|puso|quiso)${E}`)],
  // -ía fuera: "día", "policía", "panadería" la disparaban. Solo -aba/-aban
  // y la lista cerrada de irregulares frecuentes.
  ["imperfecto", re(`${B}[a-zá-úñ]+(aba|aban)${E}|${B}(era|eran|iba|iban|tenía|tenían|había|hacía|decía|veía|quería|podía|sabía|venía)${E}`)],
  ["condicional", re(`${B}[a-zá-úñ]+(ría|rían|ríamos)${E}`)],
  ["subj. presente", re(`${B}(sea|sean|tenga|tengan|haya|hagan|pueda|puedan|venga|vengan|quiera|diga|vaya)${E}`)],
  // "para", "cara", "clara" y "vara" NO son subjuntivos; sin esta exclusión
  // el A0 mexicano marcaba 14 por cada 100 oraciones.
  ["subj. imperfecto", re(`${B}(?!para${E}|cara${E}|clara${E}|rara${E}|vara${E}|tara${E}|jara${E}|mara${E})[a-zá-úñ]+(ara|aran|iera|ieran|ase|asen|iese|iesen)${E}`)],
  ["pasiva", re(`${B}(fue|fueron)\\s+[a-zá-úñ]+(ado|ada|ados|adas|ido|ida|idos|idas)${E}`)],
  ["estilo indirecto", re(`${B}(dijo|contó|explicó|preguntó|respondió|avisó)\\s+(que|si)${E}`)],
  ["conectores", re(`${B}(sin embargo|en cambio|de hecho|aun así|por más que|mientras que|a pesar de|de modo que|así que)${E}`)],
];
