import { describe, it, expect } from "vitest";
import {
  clampFeedback,
  containsWholeWord,
  gradeDeterministic,
  questionLeaksWord,
  verifyLlmForm,
} from "../speakingGrading";
import { createSpeakingExercise, type PracticeFavoriteItem } from "../practiceExercises";

// Este fichero es el GATE de dos filas de docs/rules-inventory.json. Los ids
// que ahi se declaran son "g1" y "g5"; el lint del inventario los busca aqui
// literalmente, asi que no se renombran sin tocar tambien esas dos filas.

const favorito = (extra: Partial<PracticeFavoriteItem> = {}): PracticeFavoriteItem => ({
  word: "el vecino",
  surface: "vecino",
  translation: "the neighbour",
  exampleSentence: "El vecino saluda desde el balcon cada manana.",
  storySlug: "el-vecino-del-cuarto",
  language: "spanish",
  voiceId: "yHD4CsKkghm19ToGLJEC",
  ...extra,
});

describe("g1: la pregunta no puede contener la palabra", () => {
  it("la detecta tal cual", () => {
    expect(questionLeaksWord("Como se llama tu vecino?", "el vecino", "vecino")).toBe(true);
  });

  it("la detecta sin acentos, que es como se regala igual", () => {
    // La pregunta lleva "trabajó" y la palabra pedida es "trabajo": con tilde o
    // sin ella, el usuario la lee en pantalla en vez de recuperarla.
    expect(questionLeaksWord("Donde trabajo tu hermana?", "trabajó", null)).toBe(true);
    expect(questionLeaksWord("Donde trabajó tu hermana?", "trabajo", null)).toBe(true);
  });

  it("una pregunta limpia pasa", () => {
    expect(questionLeaksWord("Quien vive en el piso de al lado?", "el vecino", "vecino")).toBe(false);
  });

  it("no confunde una palabra contenida en otra", () => {
    // "por" dentro de "porque" no es la palabra: con un includes suelto, esta
    // pregunta quedaria descartada sin motivo.
    expect(questionLeaksWord("Porque no bajaste ayer?", "por", null)).toBe(false);
    expect(containsWholeWord("Vivir aqui es bonito", "ir")).toBe(false);
  });

  it("cubre el vocab de varias palabras", () => {
    expect(questionLeaksWord("Te diste cuenta del ruido?", "darse cuenta", "diste cuenta")).toBe(true);
  });
});

describe("g5: la calificacion es verificable y el LLM no aprueba solo", () => {
  it("acierta con la forma de la historia", () => {
    const v = gradeDeterministic("Mi vecino toca la guitarra por la noche", "el vecino", "vecino");
    expect(v.correct).toBe(true);
    expect(v.via).toBe("deterministic");
    expect(v.formFound).toBe("vecino");
  });

  it("acierta con el lema aunque la transcripcion lleve puntuacion y tildes", () => {
    const v = gradeDeterministic("Si, trabajo en una libreria.", "trabajó", null);
    expect(v.correct).toBe(true);
  });

  it("falla cuando la palabra no esta", () => {
    const v = gradeDeterministic("Vive en el piso de arriba", "el vecino", "vecino");
    expect(v.correct).toBe(false);
    expect(v.formFound).toBeNull();
  });

  it("falla con transcripcion vacia", () => {
    expect(gradeDeterministic("", "el vecino", "vecino").correct).toBe(false);
  });

  it("acepta la forma verbal que el LLM senala SI esta en la transcripcion", () => {
    // Forma flexionada que la comparacion literal no cubre ("trabajaba" contra
    // el lema "trabajar"): el LLM la senala y el servidor la encuentra.
    const v = verifyLlmForm("Antes trabajaba en un bar del centro", "trabajaba");
    expect(v.correct).toBe(true);
    expect(v.via).toBe("llm");
  });

  it("RECHAZA una forma que el LLM se invento", () => {
    // El candado entero del gate: sin esto, un modelo complaciente aprueba una
    // respuesta que nunca uso la palabra.
    const v = verifyLlmForm("Vive en el piso de arriba", "trabajaba");
    expect(v.correct).toBe(false);
    expect(v.formFound).toBeNull();
  });

  it("rechaza una forma vacia", () => {
    expect(verifyLlmForm("Vive en el piso de arriba", "").correct).toBe(false);
    expect(verifyLlmForm("Vive en el piso de arriba", null).correct).toBe(false);
  });

  it("recorta el feedback por debajo de 20 palabras", () => {
    const largo = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    expect(clampFeedback(largo).split(" ").length).toBeLessThan(20);
  });
});

describe("createSpeakingExercise", () => {
  it("arma el ejercicio con lo que necesita la pregunta", () => {
    const ex = createSpeakingExercise(favorito());
    expect(ex).not.toBeNull();
    expect(ex?.type).toBe("speaking");
    expect(ex?.word).toBe("el vecino");
    expect(ex?.translation).toBe("the neighbour");
    expect(ex?.storySlug).toBe("el-vecino-del-cuarto");
    expect(ex?.sentence).toContain("vecino");
  });

  it("devuelve null sin storySlug", () => {
    expect(createSpeakingExercise(favorito({ storySlug: null }))).toBeNull();
  });

  it("devuelve null para un favorito de libro, que no tiene reparto ni voz", () => {
    expect(
      createSpeakingExercise(favorito({ sourcePath: "/books/venecia/el-canal" }))
    ).toBeNull();
  });

  it("devuelve null sin traduccion, que es la pista en pantalla", () => {
    expect(createSpeakingExercise(favorito({ translation: "" }))).toBeNull();
  });

  it("devuelve null sin frase de la historia", () => {
    expect(createSpeakingExercise(favorito({ exampleSentence: null }))).toBeNull();
  });
});
