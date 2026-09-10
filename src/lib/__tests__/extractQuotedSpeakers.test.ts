import { describe, it, expect } from "vitest";
import { extractQuotedSpeakers } from "../validateGeneratedStory";

/**
 * `narrator-speaker-introduced` saca de aquí quién habla. El 2026-09-10 pedía
 * presentar a un personaje llamado "tarde" en `la-sobremesa-se-estira`
 * (Traveler ES/Spain B2), porque el verbo portugués "conta" casaba dentro de
 * "contada". Estos casos fijan que el falso positivo no vuelva y que los
 * hablantes de verdad se sigan cazando.
 */
describe("extractQuotedSpeakers", () => {
  it("no confunde el principio de una palabra con un verbo de habla", () => {
    const text = "“Me tendría que ir; tengo la tarde contada”, avisó Claudia.";
    expect(extractQuotedSpeakers(text, "ES")).not.toContain("tarde");
    // Sin idioma se aplica la unión de listas, y tampoco debe casar.
    expect(extractQuotedSpeakers(text)).not.toContain("tarde");
  });

  it("sigue cazando al hablante sin nombre propio", () => {
    expect(extractQuotedSpeakers("“Hola”, dice la panadera.", "ES")).toContain("panadera");
    expect(extractQuotedSpeakers("Entonces la panadera pregunta: “¿Algo más?”", "ES")).toContain("panadera");
  });

  it("sigue cazando al hablante con nombre propio en los dos órdenes", () => {
    expect(extractQuotedSpeakers("“Ya voy”, contesta Toñi.", "ES")).toContain("Toñi");
    expect(extractQuotedSpeakers("Toñi pregunta: “¿Vienes?”", "ES")).toContain("Toñi");
  });

  it("caza el imperfecto, que antes solo salía por prefijo", () => {
    expect(extractQuotedSpeakers("Chucho contaba, por enésima vez, lo del río.", "ES")).toContain("Chucho");
    expect(extractQuotedSpeakers("Regina gritaba parada.", "spanish")).toContain("Regina");
  });

  it("no toma el objeto de un imperfecto por hablante", () => {
    // Frases reales de journeys: detrás del imperfecto va lo que se cuenta.
    expect(extractQuotedSpeakers("La chilanga contaba una historia distinta.", "ES")).not.toContain("historia");
    expect(extractQuotedSpeakers("No aparecía ni contestaba el celular.", "ES")).not.toContain("celular");
  });

  it("caza los verbos italianos con su lista propia", () => {
    expect(extractQuotedSpeakers("“Scendo a Livorno”, racconta Gaia.", "IT")).toContain("Gaia");
  });

  it("no toma un artículo pegado al final de otra palabra", () => {
    // "Isla" termina en "la": antes salía "vecina" como hablante.
    expect(extractQuotedSpeakers("Isla vecina dice poco.", "ES")).not.toContain("vecina");
  });

  it("aplica los verbos portugueses a un journey portugués", () => {
    expect(extractQuotedSpeakers("“Obrigado”, conta a Joana. “Tchau”, pede Rita.", "PT")).toContain("Rita");
    expect(extractQuotedSpeakers("Rita conta que chegou.", "PT")).toContain("Rita");
  });

  it("no aplica los verbos portugueses a un journey español", () => {
    expect(extractQuotedSpeakers("Rita conta los días.", "ES")).not.toContain("Rita");
  });

  it("descarta los pronombres", () => {
    expect(extractQuotedSpeakers("“Não”, ele responde. Ela pede um café.", "PT")).toEqual([]);
  });
});
