import { describe, it, expect } from "vitest";
import {
  clampFeedback,
  containsWholeWord,
  gradeDeterministic,
  questionLeaksWord,
  journeyStoryWhereFromSlug,
  verifyLlmForm,
} from "../speakingGrading";
import { createSpeakingExercise, type PracticeFavoriteItem } from "../practiceExercises";
import { buildGradeMessages } from "@/app/api/mobile/speaking/route";

// Este fichero es el GATE de dos filas de docs/rules-inventory.json. Los ids
// que ahi se declaran son "g1" y "g5"; el lint del inventario los busca aqui
// literalmente, asi que no se renombran sin tocar tambien esas dos filas.

const favorito = (extra: Partial<PracticeFavoriteItem> = {}): PracticeFavoriteItem => ({
  word: "el vecino",
  surface: "vecino",
  translation: "the neighbour",
  exampleSentence: "El vecino saluda desde el balcon cada manana.",
  // Forma REAL de la base: el lector de journey del movil guarda el pseudo-slug
  // y un sourcePath de libro.
  storySlug: "journey-cmrdqk4eb000232r4rmo619rs",
  sourcePath: "/books/standalone-stories/le-toca-a-mateo",
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
    expect(ex?.storySlug).toBe("journey-cmrdqk4eb000232r4rmo619rs");
    expect(ex?.sentence).toContain("vecino");
  });

  it("devuelve null sin storySlug", () => {
    expect(createSpeakingExercise(favorito({ storySlug: null }))).toBeNull();
  });

  it("NO descarta por sourcePath de libro: es la forma normal de un journey", () => {
    // Regresion: el filtro por `/books/` tiraba 776 de los 844 favoritos
    // reales. El lector de journey del movil guarda asi, y quien decide si hay
    // historia detras es el servidor, no la forma de la ruta.
    expect(createSpeakingExercise(favorito({ sourcePath: "/books/venecia/el-canal" }))).not.toBeNull();
  });

  it("acepta tambien el slug real, no solo el pseudo-slug", () => {
    const ex = createSpeakingExercise(
      favorito({ storySlug: "el-vecino-del-cuarto", sourcePath: null })
    );
    expect(ex?.storySlug).toBe("el-vecino-del-cuarto");
  });

  it("devuelve null sin traduccion, que es la pista en pantalla", () => {
    expect(createSpeakingExercise(favorito({ translation: "" }))).toBeNull();
  });

  it("devuelve null sin frase de la historia", () => {
    expect(createSpeakingExercise(favorito({ exampleSentence: null }))).toBeNull();
  });
});

describe("g5: el prompt de calificar no pide la frase modelo cuando ya se acerto", () => {
  const base = {
    language: "spanish",
    word: "el vecino",
    surface: "vecino",
    question: "Quien vive en el piso de al lado?",
    sentence: "El vecino saluda desde el balcon cada manana.",
    transcript: "Mi vecino toca la guitarra por la noche",
  };

  it("en la rama de ACIERTO no menciona la frase modelo ni vuelve a juzgar", () => {
    // El fallo que arregla: el prompt afirmaba SIEMPRE que la comparacion
    // literal no habia encontrado la palabra, tambien cuando si. Con eso el
    // modelo podia devolver como feedback la correccion de un error que el
    // usuario no cometio.
    const [system] = buildGradeMessages({ ...base, deterministicHit: true, formFound: "vecino" });
    expect(system.content).not.toContain("A literal comparison did not find it");
    expect(system.content).not.toContain(base.sentence);
    expect(system.content).toContain("They DID use the word");
    expect(system.content).toContain('"vecino"');
    // Solo se le pide la linea de feedback: el veredicto ya esta cerrado.
    expect(system.content).toContain('{"feedback": string}');
    expect(system.content).not.toContain('"formFound" is the EXACT substring');
  });

  it("en la rama de FALLO sigue pidiendo formFound y la frase modelo", () => {
    const [system] = buildGradeMessages({
      ...base,
      transcript: "Vive en el piso de arriba",
      deterministicHit: false,
    });
    expect(system.content).toContain("A literal comparison did not find it");
    expect(system.content).toContain('"formFound" is the EXACT substring');
    expect(system.content).toContain(base.sentence);
  });
});

describe("journeyStoryWhereFromSlug: las dos formas del storySlug", () => {
  it("el pseudo-slug del lector de journey busca por id", () => {
    expect(journeyStoryWhereFromSlug("journey-cmrdqk4eb000232r4rmo619rs")).toEqual({
      id: "cmrdqk4eb000232r4rmo619rs",
    });
  });

  it("un slug normal busca por slug", () => {
    expect(journeyStoryWhereFromSlug("le-toca-a-mateo")).toEqual({ slug: "le-toca-a-mateo" });
  });

  it("no confunde un slug que solo EMPIEZA por journey-", () => {
    // El cuid pide 20 caracteres o mas; un titulo como este es un slug real.
    expect(journeyStoryWhereFromSlug("journey-al-sur")).toEqual({ slug: "journey-al-sur" });
  });

  it("sin slug no hay busqueda", () => {
    expect(journeyStoryWhereFromSlug("")).toBeNull();
    expect(journeyStoryWhereFromSlug("   ")).toBeNull();
    expect(journeyStoryWhereFromSlug(null)).toBeNull();
    expect(journeyStoryWhereFromSlug(undefined)).toBeNull();
  });
});
