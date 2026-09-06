/** Capa de contexto del tema 4 del B2 latam. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "nadie-falta-nunca": [
    { claves: ["pizarrón"], t: "noun", g: "blackboard (Latin America)", es: "borra el pizarrón sin apuro", en: "wipes the blackboard without hurry" },
    { claves: ["subte"], t: "noun", g: "Buenos Aires underground", es: "baja del subte", en: "comes off the underground" },
    { claves: ["laburo"], t: "noun", g: "work (Buenos Aires slang)", es: "llega después del laburo", en: "arrives after work" },
    { claves: ["medialuna", "medialunas"], t: "noun", g: "Argentine sweet croissant", es: "huele a café con medialunas", en: "smells of coffee and croissants" },
    { claves: ["lapicera"], t: "noun", g: "pen (Argentina)", es: "lapicera en mano", en: "pen in hand" },
    { claves: ["tildar", "tildado"], t: "verb", g: "ticked off (tildar)", es: "tildado en rojo", en: "ticked in red" },
    { claves: ["dictar", "dicta"], t: "verb", g: "teaches, delivers (dictar)", es: "historias que ella dicta despacio", en: "stories she delivers slowly" },
    { claves: ["alumno", "alumnos"], t: "noun", g: "student", es: "Sus alumnos extranjeros", en: "her foreign students" },
    { claves: ["profesora"], t: "noun", g: "teacher", es: "la profesora de los cuentos", en: "the teacher of the stories" },
    { claves: ["promedio"], t: "noun", g: "average", es: "el promedio de cada grupo", en: "each group's average" },
    { claves: ["rendir", "rinde"], t: "verb", g: "performs (rendir)", es: "Tu grupo rinde menos", en: "your group performs worse" },
    { claves: ["aula"], t: "noun", g: "classroom", es: "en un aula que huele a café", en: "in a classroom smelling of coffee" },
    { claves: ["pelear", "pelea"], t: "verb", g: "fights (pelear)", es: "No lo pelea", en: "she does not fight it" },
    { claves: ["repaso"], t: "noun", g: "review", es: "hay módulo de repaso", en: "there is a review module" },
    { claves: ["nivel", "niveles"], t: "noun", g: "level", es: "se paga con niveles", en: "is paid in levels" },
    { claves: ["extranjero", "extranjeros"], t: "adjective", g: "foreign", es: "Sus alumnos extranjeros", en: "her foreign students" },
    { claves: ["acá"], t: "adverb", g: "here (Latin America)", es: "Acá se paga con niveles", en: "here you pay with levels" },
    { claves: ["adelante"], t: "adverb", g: "ahead", es: "dos módulos adelante", en: "two modules ahead" },
    { claves: ["tragarse el orgullo", "traga el orgullo"], t: "expression", g: "swallow your pride", es: "Se traga el orgullo", en: "she swallows her pride" },
    { claves: ["levantar la vista"], t: "expression", g: "look up", es: "sin levantar la vista", en: "without looking up" }
  ],
  "la-carta-sin-abrir": [
    { claves: ["porteño"], t: "adjective", g: "from Buenos Aires", es: "buena suerte en porteño", en: "good luck in Buenos Aires Spanish" },
    { claves: ["che"], t: "expression", g: "hey (Argentina)", es: "dónde encontrarme, che", en: "where to find me, che" },
    { claves: ["recreo"], t: "noun", g: "break", es: "en el recreo", en: "during the break" },
    { claves: ["consigna"], t: "noun", g: "task instruction", es: "una consigna por pupitre", en: "one task per desk" },
    { claves: ["pupitre"], t: "noun", g: "school desk", es: "una consigna por pupitre", en: "one task per desk" },
    { claves: ["charla"], t: "noun", g: "chat", es: "Cuando la charla se suelta", en: "when the chat loosens up" },
    { claves: ["jota"], t: "noun", g: "the letter j", es: "seis maneras de deletrear la jota", en: "six ways of spelling the letter j" },
    { claves: ["deletrear"], t: "verb", g: "to spell out", es: "deletrear la jota", en: "to spell out the letter j" },
    { claves: ["soltarse", "se suelta"], t: "verb", g: "loosens up (soltarse)", es: "la charla se suelta", en: "the chat loosens up" },
    { claves: ["estampilla", "estampillas"], t: "noun", g: "postage stamp", es: "con estampillas de colores", en: "with colourful stamps" },
    { claves: ["pendiente"], t: "adjective", g: "pending", es: "tildado como pendiente", en: "ticked as pending" },
    { claves: ["cualquiera"], t: "adjective", g: "any ordinary one", es: "un jueves cualquiera", en: "an ordinary Thursday" },
    { claves: ["parecerse", "se parece"], t: "verb", g: "resembles (parecerse)", es: "no se parece a nada", en: "is like nothing else" },
    { claves: ["mejorar", "mejoren"], t: "verb", g: "improve (mejorar)", es: "Cuando los números mejoren", en: "when the numbers improve" },
    { claves: ["avanzar", "avanzan"], t: "verb", g: "advance (avanzar)", es: "los módulos avanzan solos", en: "the modules advance on their own" },
    { claves: ["tomar lista", "toma lista"], t: "expression", g: "call the roll", es: "Toma lista sin apuro", en: "calls the roll without hurry" },
    { claves: ["levantar la mano", "levanta la mano"], t: "expression", g: "raise your hand", es: "nadie levanta la mano", en: "nobody raises a hand" },
    { claves: ["buena suerte"], t: "expression", g: "good luck", es: "cómo se dice buena suerte", en: "how you say good luck" },
    { claves: ["sin apuro"], t: "expression", g: "without hurry", es: "Toma lista sin apuro", en: "calls the roll without hurry" },
    { claves: ["al pasar"], t: "expression", g: "in passing", es: "dicha al pasar", en: "said in passing" }
  ],
  "una-idea-de-ariel": [
    { claves: ["matrícula", "matrículas"], t: "noun", g: "enrolment", es: "caen tres matrículas", en: "three enrolments land" },
    { claves: ["ficha"], t: "noun", g: "form", es: "en la ficha de inscripción", en: "on the registration form" },
    { claves: ["inscripción"], t: "noun", g: "registration", es: "la ficha de inscripción", en: "the registration form" },
    { claves: ["recomendar", "recomendó"], t: "verb", g: "recommended (recomendar)", es: "me lo recomendó una amiga", en: "a friend recommended it to me" },
    { claves: ["lectura"], t: "noun", g: "reading", es: "una hora de lectura por semana", en: "one reading hour per week" },
    { claves: ["digamos"], t: "expression", g: "let us say", es: "De cuentos, digamos", en: "of stories, let us say" },
    { claves: ["ocurrirse", "se te ocurra"], t: "verb", g: "occurs to you (ocurrirse)", es: "Ojalá se te ocurra más seguido", en: "hopefully it occurs to you more often" },
    { claves: ["más seguido"], t: "expression", g: "more often", es: "se te ocurra más seguido", en: "occurs to you more often" },
    { claves: ["de espaldas"], t: "expression", g: "with your back turned", es: "de espaldas, aguantándose la risa", en: "with her back turned, holding in her laughter" },
    { claves: ["aguantarse la risa", "aguantándose la risa"], t: "expression", g: "hold in your laughter", es: "aguantándose la risa", en: "holding in her laughter" },
    { claves: ["disfrazar", "disfrazada"], t: "verb", g: "disguised (disfrazar)", es: "la disculpa llegó disfrazada de idea", en: "the apology arrived disguised as an idea" },
    { claves: ["despegar", "despega"], t: "verb", g: "peels open (despegar)", es: "despega el sobre pendiente", en: "peels open the pending envelope" },
    { claves: ["trabarse", "me trabo"], t: "verb", g: "get stuck mid-sentence (trabarse)", es: "Cuando me trabo, cierro los ojos", en: "when I get stuck, I close my eyes" },
    { claves: ["salvar", "salvó"], t: "verb", g: "saved (salvar)", es: "El curso me salvó", en: "the course saved me" },
    { claves: ["por semana"], t: "expression", g: "per week", es: "una hora de lectura por semana", en: "one reading hour per week" },
    { claves: ["aplaudir", "aplauden"], t: "verb", g: "clap (aplaudir)", es: "aplauden bajito", en: "clap softly" },
    { claves: ["acordarse", "me acuerdo"], t: "verb", g: "I remember (acordarse)", es: "me acuerdo de los cuentos", en: "I remember the stories" },
    { claves: ["pararse", "se para"], t: "verb", g: "stands (pararse)", es: "se para en la puerta", en: "stands at the door" },
    { claves: ["ojalá"], t: "expression", g: "hopefully", es: "Ojalá se te ocurra más seguido", en: "hopefully it occurs to you more often" },
    { claves: ["por las dudas"], t: "expression", g: "just in case (Argentina)", es: "con la puerta abierta, por las dudas", en: "with the door open, just in case" }
  ]
};
(async () => {
  const p = new PrismaClient();
  let n = 0;
  for (const [slug, entradas] of Object.entries(CAPA)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...((fila?.glosses ?? {}) as Record<string, unknown>) } as Record<string, unknown>;
    for (const e of entradas) {
      if (e.es.split(/\s+/).length > 8) throw new Error(`trozo largo: ${e.es}`);
      for (const k of e.claves) { g[k] = { g: e.g, t: e.t, c: { es: e.es, en: e.en }, rev: true }; n++; }
    }
    await p.tapGlossSet.upsert({
      where: { bundle_slug: { bundle: B, slug } },
      create: { bundle: B, slug, language: "spanish", variant: "latam", slugs: [], glosses: g as never },
      update: { glosses: g as never },
    });
  }
  console.log(`claves escritas ${n}`);
  await p.$disconnect();
})();
