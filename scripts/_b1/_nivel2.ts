import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const C = `recibo contrato deposito adelanto papeleo tramite firma sello copia carpeta grifo ducha
lavadora nevera fregadero cocina persiana ventana balcon patio ruido vecino escalera portal timbre
caja cinta bombilla llave cable manta almohada sabana toalla percha cajon estante silla mesa alfombra
horario norma permiso aviso queja arreglo averia bombona basura reciclaje factura luz agua gas`.split(/\s+/).filter(Boolean);
const ok: string[] = [], no: string[] = [];
for (const w of C) (isSpanishUpToLevel(w, "b1") ? ok : no).push(w);
console.log("DENTRO (" + ok.length + "): " + ok.join(", "));
console.log("\nFUERA (" + no.length + "): " + no.join(", "));
