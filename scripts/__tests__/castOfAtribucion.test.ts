import { describe, it, expect } from "vitest";
import { castOf, type JourneyStoryInput } from "@/lib/validateJourneyStories";

/**
 * Los tres caminos de atribucion de `castOf`, uno por uno, mas los negativos
 * que demuestran que no chilla de mas. Medido el 2026-09-24: mirando solo el
 * camino narrado se perdian 139 de 335 personajes del catalogo
 * (`docs/medicion-castof-2026-09-24.md`).
 */
const Q = "“";
const QC = "”";

function h(slug: string, text: string): JourneyStoryInput {
  return { slug, title: slug, text, language: "spanish", level: "a1", topic: slug };
}

describe("castOf: camino 1, habla narrada", () => {
  it("encuentra al que va pegado a un verbo de habla en dos historias", () => {
    const st = [
      h("uno", `En la plaza, Marisol abre el puesto. ${Q}Pasa, que hace frio${QC}, dice Marisol.`),
      h("dos", `La tarde cae y Marisol cuenta las monedas. ${Q}Manana vuelvo${QC}, dice Marisol.`),
    ];
    expect(castOf(st, "ES")).toContain("Marisol");
  });

  it("no lo coge si solo habla en UNA historia", () => {
    const st = [
      h("uno", `En la plaza, Marisol abre el puesto. ${Q}Pasa${QC}, dice Marisol.`),
      h("dos", "La tarde cae sobre la plaza vacia y el puesto ya esta cerrado."),
    ];
    expect(castOf(st, "ES")).not.toContain("Marisol");
  });
});

describe("castOf: camino 2, etiqueta de dialogo", () => {
  const st = [
    h("uno", "Mariana: Vamos al mercado temprano.\n\nNicolas: Prefiero despues de comer."),
    h("dos", "Mariana: El pan ya se acabo.\n\nNicolas: Entonces compramos fruta."),
  ];

  it("lee al hablante de la etiqueta aunque no haya verbo de habla", () => {
    const cast = castOf(st, "ES");
    expect(cast).toContain("Mariana");
    expect(cast).toContain("Nicolas");
  });

  it("no confunde con una etiqueta en mitad de la frase", () => {
    const malas = [
      h("uno", "Lo dijo con dos palabras: aqui no. Y se fue sin mirar a nadie."),
      h("dos", "Volvio con la misma idea: aqui no. Nadie le llevo la contraria."),
    ];
    expect(castOf(malas, "ES")).toEqual([]);
  });
});

describe("castOf: camino 3, habla citada sin verbo de atribucion", () => {
  it("coge al sujeto que abre frase en un parrafo con cita", () => {
    const st = [
      h("uno", `Al fondo espera Marta. Marta mira el mapa arrugado. ${Q}Vamos por la izquierda${QC}.`),
      h("dos", `Bajo el toldo espera Marta. Marta cierra el paraguas. ${Q}Aqui esperamos${QC}.`),
    ];
    expect(castOf(st, "ES")).toContain("Marta");
  });

  it("no coge un VERBO al empezar frase junto a la cita", () => {
    const st = [
      h("uno", `Al fondo espera Marta. Regresa a casa con la bolsa llena. ${Q}Ya voy${QC}.`),
      h("dos", `Bajo el toldo espera Marta. Regresa a casa sin paraguas. ${Q}Ya voy${QC}.`),
    ];
    expect(castOf(st, "ES")).not.toContain("Regresa");
  });

  it("no coge el toponimo que aparece junto a la cita", () => {
    const st = [
      h("uno", `El autobus llega a Oaxaca al mediodia. ${Q}Que calor hace${QC}, dice Ana.`),
      h("dos", `Salen de Oaxaca con la primera luz. ${Q}Todavia es de noche${QC}, dice Ana.`),
    ];
    expect(castOf(st, "ES")).not.toContain("Oaxaca");
  });

  it("no coge un sustantivo comun al empezar frase", () => {
    const st = [
      h("uno", `Marta abre la nevera. El chocolate se acabo. Chocolate hay en el cajon. ${Q}Ya vere${QC}.`),
      h("dos", `Marta vuelve del mercado. Chocolate trajo de sobra, y tambien chocolate blanco. ${Q}Toma${QC}.`),
    ];
    expect(castOf(st, "ES")).not.toContain("Chocolate");
  });

  it("no cuenta fuera de un parrafo con cita", () => {
    const st = [
      h("uno", "Marta mira el mapa arrugado y decide seguir por la izquierda sin decir nada."),
      h("dos", "Marta cierra el paraguas en la puerta y espera a que pare el agua."),
    ];
    expect(castOf(st, "ES")).not.toContain("Marta");
  });
});

describe("castOf: el articulo pesa, no fulmina", () => {
  it("mantiene al personaje que una vez lleva articulo delante", () => {
    const st = [
      h("uno", `Nadia llega tarde a la barra. ${Q}Ponme un cafe${QC}, dice Nadia.`),
      h("dos", `Al fondo grita alguien: mira, la Nadia de siempre. ${Q}Ya voy${QC}, dice Nadia.`),
      h("tres", `Nadia cuelga el abrigo despacio. ${Q}Hoy no me quedo${QC}, dice Nadia.`),
    ];
    expect(castOf(st, "ES")).toContain("Nadia");
  });

  it("sigue echando al sustantivo que casi siempre va con articulo", () => {
    const st = [
      h("uno", `El Tisch esta puesto. Junto al Tisch dice Ana que falta una silla, y el Tisch cruje.`),
      h("dos", `El Tisch sigue puesto. Junto al Tisch dice Ana que ya no cruje, y el Tisch aguanta.`),
    ];
    expect(castOf(st, "ES")).not.toContain("Tisch");
  });
});

describe("castOf: la prosa narrada sigue midiendose igual", () => {
  it("no mete a nadie en un texto sin habla ni nombres", () => {
    const st = [
      h("uno", "La lluvia cae sobre los tejados y el agua baja por la calle estrecha hasta el rio."),
      h("dos", "El viento mueve las ramas y las hojas cubren el suelo del parque vacio."),
    ];
    expect(castOf(st, "ES")).toEqual([]);
  });
});
