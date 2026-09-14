import { describe, it, expect } from "vitest";
import {
  containsWholeWord,
  gradeDeterministic,
  gradeSentence,
  isSpeakingTurnAlreadyResolved,
  normalizeForSpeaking,
} from "../speakingGrading";
import {
  buildPracticeSession,
  createSpeakingExercise,
  type PracticeFavoriteItem,
} from "../practiceExercises";
import {
  buildSentenceTranslationMap,
  fillSentenceTranslationBlank,
  lookupSentenceTranslation,
  normalizeSentenceKey,
  sentenceTranslationKey,
  translationLeavesWordUntranslated,
} from "../sentenceTranslation";

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

  it("saca del mapa la traduccion de SU frase", () => {
    const ex = createSpeakingExercise(
      favorito({
        sentenceTranslations: {
          "el vecino saluda desde el balcon cada manana":
            "The neighbour waves from the balcony every morning.",
        },
      }),
      pool()
    );
    expect(ex?.sentenceTranslation).toBe(
      "The neighbour waves from the balcony every morning."
    );
  });

  it("el mapa con OTRA frase no traduce esta", () => {
    // El bug del telefono: la columna traia la frase del vocab y el ejercicio
    // pintaba otra, asi que MEANING ensenaba "a veces mas de la oracion, a
    // veces menos". Sin coincidencia exacta no se ensena nada.
    const ex = createSpeakingExercise(
      favorito({
        sentenceTranslations: {
          "rosa compra il biglietto alla biglietteria automatica della stazione":
            "Rosa buys the ticket at the station machine.",
        },
      }),
      pool()
    );
    expect(ex?.sentenceTranslation).toBeNull();
  });

  it("sin mapa, el campo viaja como null", () => {
    expect(createSpeakingExercise(favorito(), pool())?.sentenceTranslation).toBeNull();
  });

  it("devuelve null sin traduccion, que es la pista en pantalla", () => {
    expect(createSpeakingExercise(favorito({ translation: "" }), pool())).toBeNull();
  });
});

describe("fillSentenceTranslationBlank", () => {
  const FRASE = "The neighbour waves from _____ every morning.";
  const OPCIONES = ["el balcon", "la ventana", "la escalera", "el portal"];
  const GLOSAS = ["the balcony", "the window", "the staircase", "the doorway"];

  it("rellena el hueco con la glosa de la respuesta", () => {
    expect(fillSentenceTranslationBlank(FRASE, "el balcon", OPCIONES, GLOSAS)).toBe(
      "The neighbour waves from the balcony every morning."
    );
  });

  it("deja el hueco cuando no hay glosa para la respuesta", () => {
    // La respuesta esta entre las opciones pero su glosa viene vacia.
    expect(
      fillSentenceTranslationBlank(FRASE, "el balcon", OPCIONES, ["", "the window", "", ""])
    ).toBe(FRASE);
    // Y cuando no hay `optionTranslations` en absoluto.
    expect(fillSentenceTranslationBlank(FRASE, "el balcon", OPCIONES, null)).toBe(FRASE);
    // Y cuando la respuesta no esta entre las opciones.
    expect(fillSentenceTranslationBlank(FRASE, "la azotea", OPCIONES, GLOSAS)).toBe(FRASE);
  });

  it("devuelve la frase tal cual cuando no hay hueco", () => {
    const sinHueco = "The neighbour waves every morning.";
    expect(fillSentenceTranslationBlank(sinHueco, "el balcon", OPCIONES, GLOSAS)).toBe(sinHueco);
  });

  it("devuelve null cuando no hay traduccion que ensenar", () => {
    expect(fillSentenceTranslationBlank(null, "el balcon", OPCIONES, GLOSAS)).toBeNull();
    expect(fillSentenceTranslationBlank("   ", "el balcon", OPCIONES, GLOSAS)).toBeNull();
    expect(fillSentenceTranslationBlank(undefined, "el balcon", OPCIONES, GLOSAS)).toBeNull();
  });
});

describe("isSpeakingTurnAlreadyResolved: el candado del turno", () => {
  it("un turno sin resolver se puede resolver", () => {
    expect(isSpeakingTurnAlreadyResolved(null, "speaking:el vecino")).toBe(false);
    expect(isSpeakingTurnAlreadyResolved(undefined, "speaking:el vecino")).toBe(false);
    expect(isSpeakingTurnAlreadyResolved("", "speaking:el vecino")).toBe(false);
  });

  it("el MISMO turno no se resuelve dos veces", () => {
    // El bug que cierra: con un solo ejercicio, el usuario acerto y sono el
    // sonido de fallo. `advancePractice` cierra la sesion poniendo
    // `practiceRevealed` en false SIN avanzar el indice, asi que el ejercicio
    // en curso seguia siendo el mismo y el reloj se reabria encima de la
    // pantalla de resultados para calificarlo otra vez, como fallo.
    expect(isSpeakingTurnAlreadyResolved("speaking:el vecino", "speaking:el vecino")).toBe(true);
  });

  it("otro turno si se puede resolver", () => {
    expect(isSpeakingTurnAlreadyResolved("speaking:el vecino", "speaking:la ventana")).toBe(false);
  });
});

describe("lookupSentenceTranslation: solo la coincidencia exacta", () => {
  const MAPA = {
    "el vecino saluda desde el balcon cada manana":
      "The neighbour waves from the balcony every morning.",
  };

  it("casa aunque cambien acentos, mayusculas y puntuacion", () => {
    expect(
      lookupSentenceTranslation(MAPA, "\u00a1El vecino saluda desde el balc\u00f3n cada ma\u00f1ana!")
    ).toBe("The neighbour waves from the balcony every morning.");
  });

  it("acepta tambien un Map ya construido", () => {
    expect(lookupSentenceTranslation(new Map(Object.entries(MAPA)), "El vecino saluda desde el balcon cada manana.")).toBe(
      "The neighbour waves from the balcony every morning."
    );
  });

  it("otra frase no saca nada", () => {
    expect(lookupSentenceTranslation(MAPA, "El vecino baja con el perro.")).toBeNull();
  });

  it("sin mapa o sin frase, nada", () => {
    expect(lookupSentenceTranslation(null, "El vecino saluda desde el balcon cada manana.")).toBeNull();
    expect(lookupSentenceTranslation(MAPA, "")).toBeNull();
    expect(lookupSentenceTranslation({ "el vecino saluda desde el balcon cada manana": "  " }, "El vecino saluda desde el balcon cada manana.")).toBeNull();
  });

  it("la clave de una PALABRA sigue siendo la palabra", () => {
    expect(sentenceTranslationKey("  El Vecino ")).toBe("el vecino");
  });
});

describe("translationLeavesWordUntranslated", () => {
  it("caza la palabra que se quedo sin traducir", () => {
    // El fallo que la regla existe para cazar: todo traducido menos justo la
    // palabra que el ejercicio pide.
    expect(
      translationLeavesWordUntranslated(
        "The vecino waves from the balcony every morning.",
        "vecino",
        "neighbour, the person who lives next door"
      )
    ).toBe(true);
  });

  it("deja pasar el prestamo que el ingles dice igual", () => {
    // `spaghetti` en ingles ES `spaghetti`. La regla tal cual obligaba a
    // escribir "long thin pasta with bolognese sauce", que es peor traduccion.
    // La definicion en inglés lo demuestra, y es la que exime.
    expect(
      translationLeavesWordUntranslated(
        "Rosa orders spaghetti with ragu at the corner place.",
        "spaghetti",
        "Spaghetti; long thin pasta, the everyday shape in this house"
      )
    ).toBe(false);
    expect(
      translationLeavesWordUntranslated(
        "The barista already knows her order by heart.",
        "barista",
        "barista, the person who makes the coffee"
      )
    ).toBe(false);
  });

  it("sin definicion que lo respalde, sigue siendo un descuido", () => {
    expect(
      translationLeavesWordUntranslated("She orders spaghetti at noon.", "spaghetti", "")
    ).toBe(true);
    expect(
      translationLeavesWordUntranslated("She orders spaghetti at noon.", "spaghetti", null)
    ).toBe(true);
    // Una definicion que NO usa la palabra no exime.
    expect(
      translationLeavesWordUntranslated(
        "The vecino waves every morning.",
        "vecino",
        "neighbour, the person next door"
      )
    ).toBe(true);
  });

  it("no le afecta la puntuacion ni las mayusculas de la definicion", () => {
    expect(
      translationLeavesWordUntranslated(
        "They shared a pizza on the roof.",
        "pizza",
        "Pizza. The round one, shared."
      )
    ).toBe(false);
  });

  it("deja pasar el termino cultural que esta en la lista", () => {
    // `barista` esta definido como "Barman; ...", asi que la definicion NO lo
    // respalda; pero un texto en ingles lo escribe igual. Para eso existe la
    // lista de `docs/sentence-translations/keep-as-is.json`.
    expect(
      translationLeavesWordUntranslated(
        "The barista already knows her order by heart.",
        "barista",
        "Barman; the person behind the counter",
        ["barista", "ragù", "tagliatelle"]
      )
    ).toBe(false);
    // Y casa sin acentos: `ragù` de la lista contra `ragu` de la traduccion.
    expect(
      translationLeavesWordUntranslated(
        "Rosa orders pasta with ragu at the corner place.",
        "ragù",
        "Meat sauce, slow cooked",
        ["barista", "ragù", "tagliatelle"]
      )
    ).toBe(false);
  });

  it("fuera de la lista y sin respaldo en la definicion, sigue siendo un descuido", () => {
    expect(
      translationLeavesWordUntranslated(
        "The vecino waves every morning.",
        "vecino",
        "neighbour, the person next door",
        ["barista", "ragù", "tagliatelle"]
      )
    ).toBe(true);
    // Una lista vacia o ausente no exime a nadie.
    expect(
      translationLeavesWordUntranslated("She orders spaghetti.", "spaghetti", "", [])
    ).toBe(true);
    expect(
      translationLeavesWordUntranslated("She orders spaghetti.", "spaghetti", "", null)
    ).toBe(true);
  });

  it("la traduccion que SI traduce la palabra no se toca", () => {
    expect(
      translationLeavesWordUntranslated(
        "The neighbour waves from the balcony every morning.",
        "vecino",
        "neighbour, the person next door"
      )
    ).toBe(false);
  });
});

describe("buildSentenceTranslationMap: indexado por ORACION", () => {
  const FRASE_VOCAB =
    "Rosa compra il biglietto alla biglietteria automatica della stazione.";
  const FRASE_CURADA = "La macchinetta gialla della stazione non funziona mai.";
  const FILL_BLANK = {
    type: "fill_blank",
    word: "stazione",
    payload: {
      sentence: "La macchinetta gialla della _____ non funziona mai.",
      translation: "The yellow machine at _____ never works.",
      answer: "stazione",
      options: ["stazione", "piazza", "strada", "porta"],
      optionTranslations: ["the station", "the square", "the street", "the door"],
    },
  };

  it("la columna entra por su ORACION, tenga o no ejercicio esa palabra", () => {
    const mapa = buildSentenceTranslationMap({
      column: {
        [FRASE_VOCAB]: "Rosa buys the ticket at the station machine.",
        "Poi mette il foglio nella tasca.": "Then she puts the slip in her pocket.",
      },
      exercises: [FILL_BLANK],
    });
    expect(mapa.get(normalizeSentenceKey(FRASE_VOCAB))).toBe(
      "Rosa buys the ticket at the station machine."
    );
    expect(mapa.get(normalizeSentenceKey("Poi mette il foglio nella tasca."))).toBe(
      "Then she puts the slip in her pocket."
    );
    // Y la del curado sigue ahi, porque es OTRA oracion: ninguna se pisa.
    expect(mapa.size).toBe(3);
  });

  it("el fill_blank entra con la oracion ENTERA, no con el hueco", () => {
    const mapa = buildSentenceTranslationMap({ column: null, exercises: [FILL_BLANK] });
    expect(mapa.get(normalizeSentenceKey(FRASE_CURADA))).toBe(
      "The yellow machine at the station never works."
    );
    expect(mapa.size).toBe(1);
  });

  it("la columna pisa al fill_blank de la MISMA oracion", () => {
    const mapa = buildSentenceTranslationMap({
      column: { [FRASE_CURADA]: "Escrita a mano y revisada." },
      exercises: [FILL_BLANK],
    });
    expect(mapa.size).toBe(1);
    expect(mapa.get(normalizeSentenceKey(FRASE_CURADA))).toBe("Escrita a mano y revisada.");
  });

  it("una clave con comillas curvas casa con la version de comillas rectas", () => {
    const curvas = "\u201cEres un cabron\u201d, se rio Renata.";
    const rectas = '"Eres un cabron", se rio Renata.';
    const mapa = buildSentenceTranslationMap({
      column: { [curvas]: "\u201cYou are such a jerk\u201d, Renata laughed." },
      exercises: [],
    });
    expect(mapa.get(normalizeSentenceKey(rectas))).toBe(
      "\u201cYou are such a jerk\u201d, Renata laughed."
    );
  });

  it("ignora los valores vacios, los que no son texto y las claves sin letras", () => {
    const mapa = buildSentenceTranslationMap({
      column: { "Una.": "", "Dos.": "   ", "Tres.": 42, "Cuatro.": null, "...": "x", "Cinco.": "Vale." },
      exercises: [],
    });
    expect(mapa.size).toBe(1);
    expect(mapa.get(normalizeSentenceKey("Cinco."))).toBe("Vale.");
  });

  it("un fill_blank sin frase guardada no entra", () => {
    const mapa = buildSentenceTranslationMap({
      column: null,
      exercises: [{ ...FILL_BLANK, payload: { ...FILL_BLANK.payload, sentence: "" } }],
    });
    expect(mapa.size).toBe(0);
  });

  it("sin columna ni ejercicios, mapa vacio", () => {
    expect(buildSentenceTranslationMap({ column: null, exercises: [] }).size).toBe(0);
  });
});
