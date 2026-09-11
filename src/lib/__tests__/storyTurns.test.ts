import { describe, it, expect } from "vitest";
import { classifyStoryFormat, parseSpeakerTurn, paragraphIsTurn } from "../storyTurns";

describe("parseSpeakerTurn", () => {
  it("reconoce etiquetas reales del catalogo", () => {
    expect(parseSpeakerTurn("Nora: Das ist mein Ordner.")).toEqual({ speaker: "Nora", speech: "Das ist mein Ordner." });
    expect(parseSpeakerTurn("Frau Siebert: Kommen Sie rein.")?.speaker).toBe("Frau Siebert");
    expect(parseSpeakerTurn("Doña Rosa: Pasa, mija.")?.speaker).toBe("Doña Rosa");
    expect(parseSpeakerTurn("Verkäuferin: Noch etwas?")?.speaker).toBe("Verkäuferin");
  });

  it("no toma por turno un arranque de prosa con dos puntos", () => {
    for (const line of [
      "La cantina se llenó: vinieron los vecinos.",
      "Claudia se lo comentó a Marcos: la caja venía mal.",
      "Camilo piensa: esto no puede ser.",
      "Renata quiso arrancarle la libreta y no lo hizo: esperó.",
      "Am Tatort des Verbrechens: ein Zettel.",
      "Ele decide o pedido enquanto espera: coxinha.",
    ]) {
      expect(parseSpeakerTurn(line)).toBeNull();
      expect(paragraphIsTurn(line)).toBe(false);
    }
  });
});

describe("classifyStoryFormat", () => {
  const multivoz = [
    "Ana y Luis abren la tienda.",
    "Ana: Hola.",
    "Luis: Buenos días.",
    "Ana: ¿Café?",
    "Luis: Sí, gracias.",
  ].join("\n\n");

  it("multivoz completa es dialogada", () => {
    const f = classifyStoryFormat(multivoz);
    expect(f.dialogada).toBe(true);
    expect(f.narrada).toBe(false);
  });

  it("un falso positivo no vuelve dialogada una narrada", () => {
    const f = classifyStoryFormat("Renata llega.\n\nLa cantina se llenó: todos.\n\n“Hola”, dice Beto.");
    expect(f.dialogada).toBe(false);
    expect(f.narrada).toBe(true);
  });

  it("un turno suelto no exime de nada", () => {
    const f = classifyStoryFormat("Renata llega.\n\nBeto: Hola.\n\n“Adiós”, dice Renata.");
    expect(f.narrada).toBe(false);
    expect(f.dialogada).toBe(false);
  });

  it("declarada narradora nunca es dialogada", () => {
    const f = classifyStoryFormat(multivoz, "narrator");
    expect(f.dialogada).toBe(false);
    expect(f.narrada).toBe(false);
  });

  it("declarada multivoz sin turnos no se exime de los checks de multivoz", () => {
    expect(classifyStoryFormat("“Hola”, dice Beto.", "multivoice").narrada).toBe(false);
  });
});
