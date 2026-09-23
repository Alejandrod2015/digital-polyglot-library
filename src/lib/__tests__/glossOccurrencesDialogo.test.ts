import { describe, it, expect } from "vitest";
import { turnoDeUnaPalabra, glossOccurrences } from "../tapGlossChunk";

/**
 * El turno de una palabra, en los DOS formatos (2026-09-23).
 *
 * `checkGlossOccurrences` pedia un trozo de contexto por cada aparicion de
 * una palabra glosada. En un journey de formato DIALOGO media conversacion
 * son turnos de una sola palabra ("Si.", "Gracias.", "¿Casi?"), y ahi el
 * trozo seria la palabra repitiendo su propia definicion, que es justo lo que
 * `checkGlossContextReal` rechaza. Medido en el Conversations ES latam A0:
 * 15 apariciones asi, que dejaban la rama en rojo sin que hubiera nada que
 * escribir.
 *
 * La rama SE SUMA a la logica de siempre. El 95% del catalogo es prosa, asi
 * que hay un caso por camino: si el de prosa se rompe, se rompe el catalogo.
 */
const at = (texto: string, palabra: string) => glossOccurrences(palabra, texto)[0].at;

describe("turnoDeUnaPalabra", () => {
  describe("formato dialogo", () => {
    it("un turno de UNA palabra queda fuera del gate", () => {
      const texto = "Mariana: ¿Tu tampoco duermes?\nNicolas: Si.\nMariana: Yo tampoco.";
      expect(turnoDeUnaPalabra(texto, at(texto, "si"))).toBe(true);
    });

    it("un turno de VARIAS palabras sigue contando, aunque empiece por la misma", () => {
      const texto = "Nicolas: Mariana, baja.\nMariana: Si, ya voy.";
      expect(turnoDeUnaPalabra(texto, at(texto, "si"))).toBe(false);
    });

    it("la etiqueta del hablante no cuenta como palabra del turno", () => {
      const texto = "Nicolas: Gracias.";
      // sin quitar "Nicolas:" serian dos palabras y el turno contaria como hueco
      expect(turnoDeUnaPalabra(texto, at(texto, "gracias"))).toBe(true);
    });

    it("los signos de apertura y cierre no cuentan", () => {
      const texto = "Mariana: ¿Casi?";
      expect(turnoDeUnaPalabra(texto, at(texto, "casi"))).toBe(true);
    });
  });

  describe("prosa narrada", () => {
    it("una linea de prosa NO es un turno de una palabra", () => {
      const texto = "Mariana es la vecina nueva del edificio. Todas las noches, un gato gris entra por su ventana.";
      expect(turnoDeUnaPalabra(texto, at(texto, "gato"))).toBe(false);
    });

    it("una palabra en medio de un parrafo sigue pidiendo su trozo", () => {
      const texto = "En el techo de Nicolas hay una mancha nueva.\nEl agua cae, gota a gota, sobre su sofa.";
      expect(turnoDeUnaPalabra(texto, at(texto, "mancha"))).toBe(false);
      expect(turnoDeUnaPalabra(texto, at(texto, "agua"))).toBe(false);
    });

    it("el titulo, que va en su propia linea, no queda exento por ir solo", () => {
      const texto = "Un gato con dos nombres\nMariana es la vecina nueva.";
      expect(turnoDeUnaPalabra(texto, at(texto, "gato"))).toBe(false);
    });
  });
});
