import { describe, it, expect } from "vitest";
import {
  containsWholeWord,
  gradeDeterministic,
  gradeSentence,
  normalizeForSpeaking,
} from "../speakingGrading";
import {
  buildPracticeSession,
  createSpeakingExercise,
  type PracticeFavoriteItem,
} from "../practiceExercises";

// Este fichero es el GATE de la fila "g4" de docs/rules-inventory.json. El id
// que ahi se declara es "g4"; el lint del inventario lo busca aqui
// literalmente, asi que no se renombra sin tocar tambien esa fila.

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

/** Acompanantes solo para que `fill_blank` reuna sus cuatro opciones. Cada uno
 *  con SU frase: `buildPracticeSession` deduplica por oracion, asi que repetir
 *  la misma dejaria un solo ejercicio en la tanda. */
const pool = (): PracticeFavoriteItem[] => [
  favorito(),
  favorito({
    word: "la ventana",
    surface: "ventana",
    translation: "the window",
    exampleSentence: "La ventana da al patio interior del edificio.",
  }),
  favorito({
    word: "el balcon",
    surface: "balcon",
    translation: "the balcony",
    exampleSentence: "El balcon tiene macetas rojas todo el verano.",
  }),
  favorito({
    word: "la escalera",
    surface: "escalera",
    translation: "the staircase",
    exampleSentence: "La escalera cruje cuando alguien sube de noche.",
  }),
  favorito({
    word: "el portal",
    surface: "portal",
    translation: "the doorway",
    exampleSentence: "El portal se cierra solo a las diez en punto.",
  }),
  favorito({
    word: "la azotea",
    surface: "azotea",
    translation: "the rooftop",
    exampleSentence: "La azotea guarda las cuerdas de tender la ropa.",
  }),
];

describe("g4: la calificacion es determinista y local", () => {
  it("acierta con la forma de la historia", () => {
    const v = gradeDeterministic("Mi vecino toca la guitarra por la noche", "el vecino", "vecino");
    expect(v.correct).toBe(true);
    expect(v.formFound).toBe("vecino");
  });

  it("acierta con el lema aunque el reconocedor meta tildes y puntuacion", () => {
    // El reconocedor del sistema escribe con acentos y puntua; el usuario dijo
    // la palabra igual. Comparar en crudo dejaria "trabajo," fuera.
    expect(gradeDeterministic("Si, trabajo en una libreria.", "trabajó", null).correct).toBe(true);
    expect(gradeDeterministic("Donde trabajó tu hermana", "trabajo", null).correct).toBe(true);
  });

  it("cubre el vocab de varias palabras", () => {
    const v = gradeDeterministic("Me di cuenta del ruido", "darse cuenta", "di cuenta");
    expect(v.correct).toBe(true);
    expect(v.formFound).toBe("di cuenta");
  });

  it("falla cuando la palabra no esta", () => {
    const v = gradeDeterministic("Vive en el piso de arriba", "el vecino", "vecino");
    expect(v.correct).toBe(false);
    expect(v.formFound).toBeNull();
  });

  it("falla con reconocimiento vacio", () => {
    expect(gradeDeterministic("", "el vecino", "vecino").correct).toBe(false);
    expect(gradeDeterministic("   ", "el vecino", "vecino").correct).toBe(false);
  });

  it("no da por buena una palabra contenida en otra", () => {
    // "por" dentro de "porque" no es la palabra, y "ir" dentro de "vivir"
    // tampoco: con un includes suelto las dos aprobarian a quien no dijo nada.
    expect(gradeDeterministic("Porque no bajaste ayer", "por", null).correct).toBe(false);
    expect(containsWholeWord("Vivir aqui es bonito", "ir")).toBe(false);
  });

  it("normaliza quitando acentos, puntuacion y espacios de sobra", () => {
    expect(normalizeForSpeaking("  ¿Dónde   está,  el balcón? ")).toBe("donde esta el balcon");
  });
});

describe("g4: el turno pide la FRASE entera, no la palabra suelta", () => {
  const FRASE = "El vecino saluda desde el balcon cada manana";
  const grade = (transcript: string) =>
    gradeSentence(transcript, "el vecino", "vecino", FRASE);

  it("la frase entera y exacta es acierto", () => {
    const v = grade("El vecino saluda desde el balcon cada manana");
    expect(v.wordSaid).toBe(true);
    expect(v.coverage).toBe(1);
    expect(v.correct).toBe(true);
  });

  it("decir SOLO la palabra ya no basta", () => {
    // El cambio de producto entero esta en este caso: antes era acierto.
    const v = grade("vecino");
    expect(v.wordSaid).toBe(true);
    expect(v.coverage).toBeLessThan(0.5);
    expect(v.correct).toBe(false);
  });

  it("la frase entera SIN la palabra no es acierto", () => {
    const v = grade("El saluda desde el balcon cada manana");
    expect(v.wordSaid).toBe(false);
    expect(v.coverage).toBe(1);
    expect(v.correct).toBe(false);
  });

  it("la mitad justa de las demas, con la palabra, es acierto", () => {
    // Resto de la frase: saluda, desde, el, balcon, cada, manana (6 tokens;
    // "el" sale dos veces y cuenta una porque el resto se mide por token).
    const v = grade("El vecino saluda desde el balcon");
    expect(v.wordSaid).toBe(true);
    expect(v.coverage).toBeGreaterThanOrEqual(0.5);
    expect(v.correct).toBe(true);
  });

  it("por debajo de la mitad no es acierto aunque diga la palabra", () => {
    const v = grade("El vecino manana");
    expect(v.wordSaid).toBe(true);
    expect(v.coverage).toBeLessThan(0.5);
    expect(v.correct).toBe(false);
  });

  it("no le importan las tildes ni la puntuacion del reconocedor", () => {
    const v = gradeSentence(
      "¿El vecino saluda desde el balcón, cada mañana?",
      "el vecino",
      "vecino",
      FRASE
    );
    expect(v.correct).toBe(true);
    expect(v.coverage).toBe(1);
  });

  it("no le importa el orden: el reconocedor reordena y eso no es el examen", () => {
    const v = grade("manana cada balcon el desde saluda vecino");
    expect(v.correct).toBe(true);
  });

  it("cubre el vocab de varias palabras sin contarlo dos veces", () => {
    // La palabra objetivo sale del denominador: "darse cuenta" no puede
    // regalarle cobertura a quien solo dijo la palabra.
    const frase = "Me di cuenta del ruido del patio";
    const soloPalabra = gradeSentence("di cuenta", "darse cuenta", "di cuenta", frase);
    expect(soloPalabra.wordSaid).toBe(true);
    expect(soloPalabra.coverage).toBeLessThan(0.5);
    expect(soloPalabra.correct).toBe(false);

    const entera = gradeSentence(
      "Me di cuenta del ruido del patio",
      "darse cuenta",
      "di cuenta",
      frase
    );
    expect(entera.correct).toBe(true);
  });

  it("una frase que es solo la palabra no exige resto", () => {
    const v = gradeSentence("vecino", "el vecino", "vecino", "El vecino");
    expect(v.coverage).toBe(1);
    expect(v.correct).toBe(true);
  });
});

describe("createSpeakingExercise", () => {
  it("arma el ejercicio con el hueco y el clip de fill_blank", () => {
    const ex = createSpeakingExercise(favorito(), pool());
    expect(ex).not.toBeNull();
    expect(ex?.type).toBe("speaking");
    expect(ex?.translation).toBe("the neighbour");
    // La pista es la traduccion; la frase con hueco NO puede llevar la palabra.
    expect(ex?.blanked).toContain("_____");
    expect(ex?.blanked?.toLowerCase()).not.toContain("vecino");
    // Y la frase COMPLETA si la lleva: es la que se ensena en el fallo.
    expect(ex?.sentence).toContain("vecino");
  });

  it("el hueco es EXACTAMENTE el mismo que pinta fill_blank", () => {
    // Si los dos se separan, el usuario oye una frase y lee otra.
    const speaking = createSpeakingExercise(favorito(), pool());
    const fillBlank = buildPracticeSession([favorito(), ...pool()], "context").find(
      (ex) => ex.type === "fill_blank" && ex.id === "fill_blank:el vecino"
    );
    expect(fillBlank?.type).toBe("fill_blank");
    if (fillBlank?.type !== "fill_blank") throw new Error("sin fill_blank que comparar");
    expect(speaking?.blanked).toBe(fillBlank.sentence);
  });

  it("devuelve null sin storySlug", () => {
    expect(createSpeakingExercise(favorito({ storySlug: null }), pool())).toBeNull();
  });

  it("devuelve null cuando fill_blank devuelve null", () => {
    // Sin frase de ejemplo no hay hueco que decir, y el de contexto ya lo
    // rechaza: este se apoya en esa decision en vez de repetirla.
    expect(createSpeakingExercise(favorito({ exampleSentence: null }), pool())).toBeNull();
  });

  it("NO descarta por sourcePath de libro: es la forma normal de un journey", () => {
    // Regresion: un filtro por `/books/` tiraba 776 de los 844 favoritos
    // reales, porque el lector de journey del movil guarda asi.
    expect(createSpeakingExercise(favorito(), pool())).not.toBeNull();
  });

  it("acepta una oracion de 12 palabras", () => {
    // Exactamente el tope: entra.
    const doce = "El vecino baja cada tarde con su perro y saluda al portero";
    expect(doce.trim().split(/\s+/).length).toBe(12);
    expect(createSpeakingExercise(favorito({ exampleSentence: doce }), pool())).not.toBeNull();
  });

  it("devuelve null con una oracion de 13 palabras", () => {
    // Una palabra por encima del tope: fuera.
    const trece = "El vecino baja cada tarde con su perro y saluda al portero joven";
    expect(trece.trim().split(/\s+/).length).toBe(13);
    expect(createSpeakingExercise(favorito({ exampleSentence: trece }), pool())).toBeNull();
  });

  it("descarta la oracion de 15 palabras y 99 caracteres que el usuario vio larga", () => {
    // El caso real que hizo bajar el tope de 15 a 12: pasaba los dos topes
    // anteriores (15 palabras, menos de 100 caracteres) y aun asi era larga.
    const quince = "El vecino baja cada tarde con su perro y saluda a todos desde el portal";
    expect(quince.trim().split(/\s+/).length).toBe(15);
    expect(quince.length).toBeLessThan(100);
    expect(createSpeakingExercise(favorito({ exampleSentence: quince }), pool())).toBeNull();
  });

  it("devuelve null sin oracion limpia, por larga que sea la de ejemplo", () => {
    // Varias oraciones y mas de 100 caracteres: no hay UNA oracion limpia que
    // decir. Sin frase de reserva; antes se caia a `getContextSentence` y de
    // ahi salian las frases de 40 palabras que vio el usuario.
    const parrafo =
      "El vecino saluda desde el balcon cada manana. Despues baja con el perro " +
      "y se queda un rato en el portal hablando con quien pase por delante, " +
      "aunque llueva y aunque nadie le haya preguntado nada de nada.";
    expect(parrafo.length).toBeGreaterThan(100);
    expect(createSpeakingExercise(favorito({ exampleSentence: parrafo }), pool())).toBeNull();
  });

  it("devuelve null sin traduccion, que es la pista en pantalla", () => {
    expect(createSpeakingExercise(favorito({ translation: "" }), pool())).toBeNull();
  });
});
