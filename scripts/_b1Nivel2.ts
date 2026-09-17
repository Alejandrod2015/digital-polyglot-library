/**
 * Dice si una palabra candidata cae dentro de B1 para el eje de frecuencia del
 * validador. Usa `isSpanishUpToLevel` directo: el juez de arriba lleva el
 * fence `server-only` y no se puede cargar desde un script suelto.
 */
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";
const ws = process.argv.slice(2);
const dentro = ws.filter((w) => isSpanishUpToLevel(w, "b1"));
const fuera = ws.filter((w) => !isSpanishUpToLevel(w, "b1"));
console.log("DENTRO: " + dentro.join(", "));
console.log("FUERA:  " + fuera.join(", "));
