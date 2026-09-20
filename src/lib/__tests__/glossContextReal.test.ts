import { describe, expect, it } from "vitest";
import { evaluarEntradaGlossContext } from "@/lib/glossContextReal";

describe("evaluarEntradaGlossContext", () => {
  it("caza el caso real FR A1 Friends: c.es = la palabra sola, c.en = la definicion cortada", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "boulangerie",
      c: { es: "boulangerie", en: "a shop that sells bread" },
      g: "bakery",
      texto: "Voy a la boulangerie cada mañana a comprar pan fresco.",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toBe("es-es-la-palabra-sola");
  });

  it("caza el caso real FR B1 Friends: c.en = la glosa de la palabra, no la traduccion del trozo", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "agent",
      c: { es: "Guillaume, agent immobilier", en: "staff member at a counter" },
      g: "staff member at a counter",
      texto: "Guillaume, agent immobilier, nous a montré trois appartements.",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toBe("en-es-la-glosa");
  });

  it("pasa una entrada buena: trozo real y traduccion del trozo, distinta de la glosa", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "cerrado",
      c: { es: "huele a cerrado", en: "it smells stuffy in here" },
      g: "closed",
      texto: "Al entrar en el sótano, huele a cerrado y hace frío.",
    });
    expect(v.ok).toBe(true);
  });

  it("pasa una replica real de una palabra sola, tipo Voilà.", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "voilà",
      c: { es: "Voilà.", en: "There you go, here it is." },
      g: "look, there",
      texto: "Marie me tiende la llave. Voilà. Ya puedes entrar.",
    });
    expect(v.ok).toBe(true);
  });

  it("pasa una replica de una palabra entre dos replicas de dialogo (?” “Vienes.)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "vienes",
      c: { es: "Vienes.", en: "You'll come." },
      g: "you come",
      texto: "“Me pagas el viernes”, propone Patricia. “¿Y si no vengo?” “Vienes. Ustedes son las de la escuela de baile, ¿no?”",
    });
    expect(v.ok).toBe(true);
  });

  it("sigue cazando la palabra sola cuando no cierra una frase", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "vienes",
      c: { es: "Vienes.", en: "You'll come." },
      g: "you come",
      texto: "“¿Y si no vengo?” “Si vienes mañana, te pago el viernes.”",
    });
    expect(v.ok).toBe(false);
  });

  it("falla si c.es no aparece literal en el texto de la historia", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "horno",
      c: { es: "el horno apagado", en: "the switched-off oven" },
      g: "oven",
      texto: "La cocina huele a pan recién hecho, no a horno frío.",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toBe("es-no-esta-en-el-texto");
  });

  it("falla si c.en empieza por la glosa aunque traiga mas palabras detras (trozo largo, no un articulo suelto)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "primero",
      c: { es: "el primero por adelantado", en: "the first one in advance" },
      g: "the first one",
      texto: "Paga el primero por adelantado y el resto al terminar.",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toBe("en-es-la-glosa");
  });

  it("pasa un trozo corto de verdad: sustantivo con su articulo (Le chômage)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "chômage",
      c: { es: "Le chômage", en: "Unemployment" },
      g: "unemployment",
      texto: "Le chômage touche toute la famille cette année-là.",
    });
    expect(v.ok).toBe(true);
  });

  it("pasa un trozo corto de verdad: pronombre sujeto mas el verbo (tu verras)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "verras",
      c: { es: "tu verras", en: "you'll see" },
      g: "you will see",
      texto: "Attends un peu, tu verras ce qu'il a préparé.",
    });
    expect(v.ok).toBe(true);
  });

  it("pasa un trozo corto de verdad: demostrativo mas sustantivo (Ce soir-là)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "soir",
      c: { es: "Ce soir-là", en: "That evening" },
      g: "evening",
      texto: "Ce soir-là, personne n'a voulu rentrer tôt.",
    });
    expect(v.ok).toBe(true);
  });

  it("pasa un trozo corto de verdad: locucion con preposicion y pronombre (Merci à tous)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "merci",
      c: { es: "Merci à tous", en: "Thank you, everyone" },
      g: "thank you",
      texto: "Merci à tous d'être venus ce soir.",
    });
    expect(v.ok).toBe(true);
  });

  it("pasa un verbo separable aleman citado con elipsis, sin pegar las dos mitades", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "ab",
      c: { es: "holt … ab", en: "picks up" },
      g: "off, away",
      texto: "Statt in einem schicken Wagen holt sie die beiden lachend auf einem alten Fahrrad direkt vom Bahnsteig ab.",
    });
    expect(v.ok).toBe(true);
  });

  it("falla un verbo separable si las dos mitades no aparecen en orden en el texto", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "ab",
      c: { es: "holt … ab", en: "picks up" },
      g: "off, away",
      texto: "Ella espera en el andén mientras él compra el billete.",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toBe("es-no-esta-en-el-texto");
  });

  it("ignora mayusculas y parentesis al comparar c.en contra la glosa", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "fresas",
      c: { es: "vende fresas rojas", en: "Posh, Snobby (attitude)" },
      g: "posh, snobby",
      texto: "En el mercado, la señora vende fresas rojas cada sábado.",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toBe("en-es-la-glosa");
  });

  // Fixture real: spanish-friends-spain-a2 (2026-09-16). La comilla curva de
  // apertura va PEGADA a la palabra en el estilo del catalogo (“Claro, sin
  // espacio), asi que esReplicaDeUnaPalabra no reconocia NINGUNA replica de
  // una sola palabra en ningun journey: el espacio tras la comilla era
  // obligatorio y las comillas curvas no estaban en la clase aceptada.
  it("reconoce una replica real de una palabra con la comilla pegada (Claro)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "claro",
      c: { es: "Claro. Con la guitarra", en: "Sure. With the guitar" },
      g: "of course, sure (claro)",
      texto: "¿Estás bien?”, preguntó Rubén. “Claro. Con la guitarra, a veces todo pesa menos”, contestó ella.",
    });
    expect(v.ok).toBe(true);
  });

  // Mismo caso, con el signo de apertura invertido del español (¿) entre la
  // comilla y la palabra: sigue siendo una replica de una sola palabra, ese
  // signo no es parte de ella.
  it("reconoce una replica real de una palabra tras un signo ¿ pegado (Ves)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "ves",
      c: { es: "¿Ves? No necesitamos coche", en: "See? We don't need a car" },
      g: "you see",
      texto: "el local los esperaba con la puerta abierta. “¿Ves? No necesitamos coche”, gritó Rubén desde detrás del bombo.",
    });
    expect(v.ok).toBe(true);
  });

  it("reconoce una replica real de una palabra con la comilla pegada (Perdona)", () => {
    const v = evaluarEntradaGlossContext({
      palabra: "perdona",
      c: { es: "Perdona. Tenía clase hasta las siete", en: "Sorry. I had lessons until seven" },
      g: "sorry (perdonar)",
      texto: "Lorena llegó tarde, con la guitarra. “Perdona. Tenía clase hasta las siete. ¿Estás preparado?”, preguntó.",
    });
    expect(v.ok).toBe(true);
  });

  it("la regex vieja (espacio obligatorio, sin comillas curvas) fallaba estos tres casos", () => {
    // Reproduce aqui, sin exportarla, la regex ANTERIOR al arreglo del
    // 2026-09-16, para dejar constancia de que el fallo era real y no una
    // sospecha: las tres replicas de arriba (Claro, Ves, Perdona), con sus
    // frases y textos reales, no pasaban.
    const reVieja = (palabra: string, texto: string) => {
      const p = palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[.!?]["'\`»]?\\s+)${p}[.!?]`, "iu");
      return re.test(texto);
    };
    expect(reVieja("claro", "¿Estás bien?”, preguntó Rubén. “Claro. Con la guitarra, a veces todo pesa menos”, contestó ella.")).toBe(false);
    expect(reVieja("ves", "el local los esperaba con la puerta abierta. “¿Ves? No necesitamos coche”, gritó Rubén desde detrás del bombo.")).toBe(false);
    expect(reVieja("perdona", "Lorena llegó tarde, con la guitarra. “Perdona. Tenía clase hasta las siete. ¿Estás preparado?”, preguntó.")).toBe(false);
  });
});
