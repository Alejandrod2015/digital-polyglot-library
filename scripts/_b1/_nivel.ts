import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const CAND = `fianza alquiler casero habitación mudanza colchón calefacción radiador gotera humedad
ascensor buzón aval nómina diapositiva portátil sala acta resumen agenda pantalla enchufe altavoz
proyector ponente tranvía andén abono taquilla mochila apunte beca matrícula aula`.split(/\s+/).filter(Boolean);
const ok: string[] = [], no: string[] = [];
for (const w of CAND) (isSpanishUpToLevel(w, "b1") ? ok : no).push(w);
console.log("DENTRO de B1 (" + ok.length + "):", ok.join(", "));
console.log("\nFUERA, el juez las da C2 (" + no.length + "):", no.join(", "));
