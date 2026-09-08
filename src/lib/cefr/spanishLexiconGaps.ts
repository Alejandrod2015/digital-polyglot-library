/**
 * HUECOS del lexico graduado: espanol corriente que las listas A1-C1 no
 * tienen, casi todo sustantivo concreto.
 *
 * POR QUE (2026-09-08). `journey-vocab-worth-teaching` prueba si una palabra
 * esta en el lexico graduado hasta C1; si no esta, la cuenta como color local
 * que no merece plaza. La idea es buena y el proxy es tosco: las listas
 * cubren bien verbos y abstractos y fatal los objetos del mundo. Medido en el
 * B1 latam, de 58 plazas señaladas la MITAD eran palabras que cualquier
 * hispanohablante conoce (`teja`, `alacena`, `despensa`, `yema`, `fogon`,
 * `bordar`, `terciopelo`, `cofradia`), y con esa vara el gate empujaba a
 * cambiarlas por otras peores.
 *
 * Lo cazo el chat ejecutor negandose a ejecutar el encargo: "si el gate no
 * contara esas, el journey queda a un pelo del tope y sin tocar un ancla".
 * Tenia razon, asi que el arreglo es del gate, no del journey.
 *
 * QUE ENTRA AQUI: palabra que un hispanohablante de CUALQUIER pais entiende
 * sin contexto. Nada regional. `zonda`, `bahareque`, `milcao`, `chontaduro` o
 * `changarin` NO entran, y por eso el gate los sigue contando: son justo lo
 * que el usuario señalo al tocar `zonda` en el lector y no saber que era
 * siendo nativo.
 *
 * Esta lista es deuda, no diseño: cada palabra de aqui deberia acabar en la
 * lista graduada que le toque por nivel. Mientras tanto, hace que el gate
 * mida lo que dice medir.
 */
export const HUECOS_LEXICO_ES = new Set<string>([
  // Casa y objetos
  "teja", "alacena", "despensa", "zaguan", "zaguán", "fogon", "fogón",
  "terciopelo", "bastidor", "cinto", "pollera",
  // Campo y planta
  "vid", "yema", "brote", "sarmiento", "parral", "hilera", "surco", "riego",
  "cerco", "vega", "aliso", "cafetal", "acequia",
  // Oficio y edificio
  "cofradia", "cofradía", "mayordomo", "retablo", "bordar", "arriero",
  "galpon", "galpón", "cuartel",
  // Otros de uso general
  "colorado", "nevado", "ojala", "ojalá", "bienvenido", "guayaba",
  "mochilero", "milanesa", "cantina", "directorio", "buzo", "timbrar",
  "desquite", "arriendo",
  // Variantes de pais que TODO hispanohablante entiende aunque no las use:
  // un español dice camarero, boligrafo o pizarra, pero sabe que es un mozo,
  // un lapicero y un pizarron. La linea la marca entenderlo, no usarlo.
  "mozo", "lapicero", "lapicera", "pizarron", "pizarrón", "fierro", "trastes",
]);

/** ¿Es espanol corriente que la lista graduada simplemente no tiene? */
export function esHuecoDelLexico(palabra: string): boolean {
  return HUECOS_LEXICO_ES.has(palabra.trim().toLowerCase());
}
