/* Cinco escenas de anuncio, cada una funcion PURA del tiempo: el render las
 * pide fotograma a fotograma con __ad.seek(t), asi que no dependen del reloj
 * de la maquina y salen identicas en cada tirada.
 *
 *   adScenes.html?scene=1&ratio=916
 */
(function () {
  const params = new URLSearchParams(location.search);
  const SCENE = Number(params.get("scene") || 1);
  const RATIO = params.get("ratio") === "45" ? "45" : "916";

  /* Franja de seguridad: en Stories la cabecera de Instagram se come la parte
   * de arriba y en Reels el pie (autor, texto, botones) se come la de abajo.
   * 250 px arriba y 340 px de los 1920 quedan libres de contenido; el fondo
   * si llega a los bordes. El 4:5 del feed no lleva superposiciones. */
  const GEO = {
    "45": {
      // 68 px arriba y abajo = el cuadrado central. En feed Meta no pinta
      // nada encima del creativo, pero en algunas superficies lo recorta a
      // 1:1, y ahi se llevaba por delante la primera linea del titular.
      w: 540, h: 675, scale: 0.85, safeTop: "84px", safeBottom: "56px",
      hookSize: "25px", subSize: "12px", phoneTop: "10px",
    },
    "916": {
      w: 540, h: 960, scale: 0.85, safeTop: "125px", safeBottom: "170px",
      hookSize: "36px", subSize: "16px", phoneTop: "14px",
    },
  }[RATIO];

  const R = document.documentElement.style;
  R.setProperty("--w", GEO.w + "px");
  R.setProperty("--h", GEO.h + "px");
  R.setProperty("--scale", String(GEO.scale));
  R.setProperty("--safeTop", GEO.safeTop);
  R.setProperty("--safeBottom", GEO.safeBottom);
  R.setProperty("--hookSize", GEO.hookSize);
  R.setProperty("--subSize", GEO.subSize);
  R.setProperty("--phoneTop", GEO.phoneTop);

  /* Las historias del lector. El texto es el publicado (recortado a lo que
   * cabe en pantalla) y las palabras marcadas son vocabulario REAL de la
   * ficha de la historia, con su definicion tal cual. */
  const STORIES = {
    mole: {
      title: "Mole en San Ángel",
      cover: "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/covers/journey-stories/mole-en-san-angel-1778228912112.png",
      total: 70,
      text:
        "Es jueves al mediodía. La fonda de San Ángel está abierta y huele a mole. " +
        "En la cocina, doña Luz mueve una olla grande.\n" +
        "Hoy está cansada. Pero ella sonríe. Don Pedro pide su mole también. " +
        "Comen juntos en silencio.",
      sky: ["fonda", "mole", "olla"],
      green: ["cansada"],
    },
    // Historias de relleno para desarrollar sin la base; adStories.js las pisa.
    _ahorita_placeholder: {
      title: "Ahorita salgo",
      cover: "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/images/ahorita-salgo-styleB-flux-1784227387301.png",
      total: 96,
      text:
        "Cuando decía “ahorita salgo”, había que sumarle una hora, a veces dos.\n" +
        "Esa noche los demás llevaban rato echando raíces en la esquina, " +
        "muertos de frío.",
      sky: ["ahorita", "echando", "raíces"],
      green: [],
    },
    _hormigas_placeholder: {
      title: "Las hormigas culonas",
      cover: "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/images/las-hormigas-culonas-styleB-flux-1784391490465.png",
      total: 104,
      text:
        "Un vendedor pregonaba sus hormigas culonas tostadas. " +
        "Nubia llegó con una bolsa repleta de bichos crocantes.\n" +
        "“Pruébela sin miedo, no sea delicada, que estas son puro monte”, la animó Nubia.",
      sky: ["hormigas", "culonas", "bichos"],
      green: ["crocantes"],
    },
  };

  /* Lo que trae adStories.js manda: son las palabras del texto publicado con
   * los milisegundos de SU narracion, no una estimacion. */
  const PREBUILT = window.__AD_STORIES || {};
  Object.keys(PREBUILT).forEach(function (k) { STORIES[k] = PREBUILT[k]; });

  /** Clase de color segun el tipo de palabra, como en el lector. */
  function runClass(kind) {
    return "vrun vrun" + kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  /** Sin acentos, sin comillas y sin puntuacion: "“ahorita”," casa con "ahorita". */
  function norm(w) {
    return w.toLowerCase().replace(/[“”".,;:¿?¡!]/g, "");
  }

  /**
   * Los tiempos del karaoke se calculan, no se escriben a mano: cada palabra
   * dura segun su largo, y la puntuacion añade el respiro que hace un
   * narrador. Basta para que se lea como audio de verdad.
   */
  function build(story) {
    const words = [];
    let t = 0;
    story.text.split("\n").forEach(function (para, pi) {
      para.split(/\s+/).filter(Boolean).forEach(function (raw, wi) {
        const key = norm(raw);
        const dur = 0.2 + raw.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "").length * 0.052;
        const kind = story.sky.indexOf(key) !== -1 ? "sky"
          : story.green.indexOf(key) !== -1 ? "green" : null;
        // La comilla de apertura sale FUERA del realce: dentro, la pastilla
        // empieza en un signo y se lee como un error de maquetacion.
        const m = raw.match(/^([“¿¡]*)([\s\S]*)$/);
        words.push({ pre: m[1], t: m[2], s: t, e: t + dur, kind: kind, br: pi > 0 && wi === 0 });
        t += dur + (/[.,;:”]$/.test(raw) ? 0.16 : 0.02);
      });
    });
    return { words: words, duration: t };
  }

  const GLOSSES = {
    fonda: { pos: "NOUN", def: "Small family-run eatery serving home-style food" },
    "mole.": { pos: "NOUN", def: "Chili-and-chocolate sauce, the pride of a Mexican kitchen" },
    olla: { pos: "NOUN", def: "Wide clay pot the sauce simmers in for hours" },
  };

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  const ICON = {
    wifi: '<svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 3.5 a7 7 0 0 1 11 0M2.6 5.6 a4.5 4.5 0 0 1 7.8 0M4.4 7.7 a2.2 2.2 0 0 1 4.2 0" stroke-linecap="round"/></svg>',
    battery: '<svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.45"/><rect x="2" y="2" width="15" height="7" rx="1.5" fill="currentColor"/><path d="M20 4 v3" stroke="currentColor" opacity="0.45" stroke-linecap="round"/></svg>',
    back: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    save: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>',
    down: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    heart: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><line x1="17" y1="9" x2="17" y2="13"/><line x1="15" y1="11" x2="19" y2="11"/></svg>',
    back10: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    fwd10: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    chevUp: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    speaker: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    bolt: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 L4 14 h7 l-1 8 9-12 h-7 z"/></svg>',
    gem: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9 L12 2 L18 9 L12 22 z"/></svg>',
    cursor: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-6 1-1 6L5 3z"/></svg>',
    search: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    check: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    arrow: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
  };

  const FLAG = {
    MX: '<rect width="1" height="2" x="0" fill="#006847"/><rect width="1" height="2" x="1" fill="#FFFFFF"/><rect width="1" height="2" x="2" fill="#CE1126"/>' +
      '<image href="../../public/flags/mx-coat.png" x="1.06" y="0.53" width="0.88" height="0.94" preserveAspectRatio="xMidYMid meet"/>',
    ES: '<rect width="3" height="2" fill="#AA151B"/><rect width="3" height="1" y="0.5" fill="#F1BF00"/>',
    CO: '<rect width="3" height="1" y="0" fill="#FCD116"/><rect width="3" height="0.5" y="1" fill="#003893"/><rect width="3" height="0.5" y="1.5" fill="#CE1126"/>',
    BR: '<rect width="3" height="2" fill="#009C3B"/><polygon points="1.5,0.2 2.75,1 1.5,1.8 0.25,1" fill="#FFDF00"/><circle cx="1.5" cy="1" r="0.4" fill="#002776"/>',
    IT: '<rect width="1" height="2" x="0" fill="#009246"/><rect width="1" height="2" x="1" fill="#FFFFFF"/><rect width="1" height="2" x="2" fill="#CE2B37"/>',
    DE: '<rect width="3" height="0.667" y="0" fill="#000000"/><rect width="3" height="0.667" y="0.667" fill="#DD0000"/><rect width="3" height="0.666" y="1.333" fill="#FFCE00"/>',
    PE: '<rect width="1" height="2" x="0" fill="#D91023"/><rect width="1" height="2" x="1" fill="#FFFFFF"/><rect width="1" height="2" x="2" fill="#D91023"/>',
    AR: '<rect width="3" height="2" fill="#74ACDF"/><rect width="3" height="0.667" y="0.667" fill="#FFFFFF"/><circle cx="1.5" cy="1" r="0.2" fill="#F6B40E"/>',
  };
  function flag(code, size) {
    return '<svg viewBox="0 0 3 2" width="' + size + '" height="' + (size * 2) / 3 +
      '" style="border-radius:2px;display:inline-block;vertical-align:middle;overflow:hidden">' +
      FLAG[code] + "</svg>";
  }

  /* ---------------- guion de las cinco escenas ---------------- */
  const SCENES = {
    1: {
      screen: "reader", story: "mole",
      hook: ['Every word lights up', '<span class="lime">as you hear it.</span>'],
      sub: "Short stories, narrated by real Spanish voices.",
      duration: 8,
    },
    2: {
      screen: "reader", story: "mole",
      hook: ['Stuck on a word?', '<span class="lime">Tap it.</span>'],
      sub: "The meaning shows up where you are, in context.",
      duration: 8,
      taps: [{ word: "fonda", at: 1.8 }],
    },
    3: {
      screen: "practice",
      hook: ['Then you use it.', '<span class="lime">No flashcards.</span>'],
      sub: "Practice built from the story you just heard.",
      duration: 8,
    },
    4: {
      screen: "catalog",
      hook: ['Mexico. Madrid. Bogotá.', 'Not just <span class="lime">&ldquo;Spanish&rdquo;.</span>'],
      sub: "Every journey is written and voiced where it is set.",
      duration: 8,
    },
    5: {
      screen: "reader", story: "mole",
      hook: ['Books say <i>restaurante</i>.', 'Cooks say <span class="lime"><i>fonda</i></span>.'],
      sub: "The words people actually use, learned in a story.",
      duration: 8,
      taps: [
        { word: "fonda", at: 1.4 },
        { word: "mole.", at: 3.9 },
        { word: "olla", at: 6.2 },
      ],
    },
    6: {
      screen: "reader", story: "ahorita",
      hook: ['In Mexico, <i>ahorita</i>', 'means <span class="lime">maybe never</span>.'],
      sub: "The slang a textbook skips, learned inside a story.",
      // La tarjeta entra un poco despues de que suene la palabra, como quien
      // la oye primero y luego la busca; se cierra y mas tarde entra la otra.
      glosses: [
        {
          trigger: "ahorita", word: "ahorita", pos: "ADVERB", lit: ["ahorita"],
          delay: 0.9, until: 8.5,
          def: "Mexican now that can mean soon, later, or never",
        },
        {
          trigger: "neta", word: "neta", pos: "NOUN", lit: ["neta"],
          delay: 0.6,
          def: "Mexican slang for the honest truth, or seriously",
        },
      ],
      duration: 15,
    },
    7: {
      screen: "reader", story: "hormigas",
      hook: ['<i>Hormigas culonas.</i>', '<span class="lime">Yes, it means that.</span>'],
      sub: "Roasted ants, a Santander delicacy, in a real story.",
      glosses: [
        {
          trigger: "hormigas", word: "hormigas culonas", pos: "NOUN",
          lit: ["hormigas", "culonas"], delay: 0.3, until: 9.5,
          def: "Big bottomed ants, roasted and eaten as a Santander delicacy",
        },
      ],
      duration: 15,
    },
    8: {
      screen: "reader", story: "causa",
      hook: ['Lima says <i>habla causa</i>.', 'A book says <span class="lime">&ldquo;hola&rdquo;</span>.'],
      sub: "Peruvian slang, in a story that actually uses it.",
      glosses: [
        {
          trigger: "causa", word: "habla causa", pos: "EXPRESSION",
          lit: ["habla", "causa"], delay: 0.5, until: 9,
          def: "Hey buddy, a classic Lima greeting between friends",
        },
        {
          trigger: "toque", word: "al toque", pos: "EXPRESSION",
          lit: ["al", "toque"], delay: 0.6,
          def: "Right away, immediately, in a flash without waiting",
        },
      ],
      duration: 15,
    },
    9: {
      screen: "reader", story: "previa",
      hook: ['Argentina has a word', 'for <span class="lime">pre-drinks</span>.'],
      sub: "Buenos Aires slang, inside the story that uses it.",
      glosses: [
        {
          trigger: "previa", word: "previa", pos: "NOUN", lit: ["previa"],
          delay: 0.9, until: 7.5,
          def: "The pre party warm up with drinks before going out",
        },
        {
          trigger: "piba", word: "piba", pos: "NOUN", lit: ["piba"],
          delay: 1,
          def: "A girl or young woman, very common in Buenos Aires",
        },
      ],
      duration: 15,
    },
    10: {
      screen: "reader", story: "escoba",
      hook: ['Chile has a phrase', 'for <span class="lime">a wild night</span>.'],
      sub: "Chilean slang, inside the story that uses it.",
      glosses: [
        {
          trigger: "escoba", word: "quedar la escoba", pos: "EXPRESSION",
          litRange: [14, 16], delay: 0.55, until: 10.2,
          def: "Here it turned out wild; usually a huge mess though",
        },
        {
          trigger: "weviaban", word: "weviar", pos: "VERB",
          lit: ["weviaban"], delay: 0.55,
          def: "To tease and mess around with someone playfully",
        },
      ],
      duration: 15,
    },
    12: {
      screen: "reader", story: "ahorita", theme: "light",
      hook: ['In Mexico, <i>ahorita</i>', 'means <span class="lime">maybe never.</span>'],
      sub: "The slang a textbook skips, learned inside a story.",
      glosses: [
        {
          trigger: "ahorita", word: "ahorita", pos: "ADVERB", lit: ["ahorita"],
          delay: 0.9, until: 8.5,
          def: "Mexican now that can mean soon, later, or never",
        },
        {
          trigger: "neta", word: "neta", pos: "NOUN", lit: ["neta"],
          delay: 0.6,
          def: "Mexican slang for the honest truth, or seriously",
        },
      ],
      duration: 15,
    },
    // A. El telefono grande y a sangre, como el anuncio de referencia.
    13: {
      screen: "reader", story: "ahorita", theme: "light", bleed: 1.55,
      hook: ['In Mexico, <i>ahorita</i>', 'means <span class="lime">maybe never.</span>'],
      sub: "The slang a textbook skips, learned inside a story.",
      glosses: [
        {
          trigger: "ahorita", word: "ahorita", pos: "ADVERB", lit: ["ahorita"],
          delay: 0.9, until: 8.5,
          def: "Mexican now that can mean soon, later, or never",
        },
        {
          trigger: "neta", word: "neta", pos: "NOUN", lit: ["neta"],
          delay: 0.6,
          def: "Mexican slang for the honest truth, or seriously",
        },
      ],
      duration: 15,
    },
    // B. Sin telefono: la historia a tamano de titular.
    14: {
      screen: "reader", story: "ahorita", theme: "light", layout: "type",
      hook: ['In Mexico, <i>ahorita</i>', 'means <span class="lime">maybe never.</span>'],
      sub: "Real Spanish, and the word that trips everyone up.",
      glosses: [
        {
          trigger: "ahorita", word: "ahorita", pos: "ADVERB", lit: ["ahorita"],
          delay: 0.9, until: 8.5,
          def: "Mexican now that can mean soon, later, or never",
        },
        {
          trigger: "neta", word: "neta", pos: "NOUN", lit: ["neta"],
          delay: 0.6,
          def: "Mexican slang for the honest truth, or seriously",
        },
      ],
      duration: 15,
    },
    // C. Manda la portada; el texto va debajo, como un pie de foto.
    15: {
      screen: "reader", story: "ahorita", theme: "light", layout: "cover",
      hook: ['In Mexico, <i>ahorita</i>', 'means <span class="lime">maybe never.</span>'],
      sub: "",
      glosses: [
        {
          trigger: "ahorita", word: "ahorita", pos: "ADVERB", lit: ["ahorita"],
          delay: 0.9, until: 8.5,
          def: "Mexican now that can mean soon, later, or never",
        },
        {
          trigger: "neta", word: "neta", pos: "NOUN", lit: ["neta"],
          delay: 0.6,
          def: "Mexican slang for the honest truth, or seriously",
        },
      ],
      duration: 15,
    },
    // Iteracion 1: mismo molde que la pieza con mas clics (crema, a sangre,
    // titular con la traduccion literal del modismo).
    22: {
      screen: "reader", story: "suelos", theme: "light", bleed: 1.55,
      hook: ['In Mexico, feeling low is', '<span class="lime">&ldquo;spirits on the floor&rdquo;.</span>'],
      sub: "Short narrated stories. Tap any word for its meaning.",
      glosses: [
        {
          trigger: "ánimo", word: "ánimo por los suelos", pos: "EXPRESSION",
          litRange: [28 - 18, 31 - 18], delay: 0.7, until: 9.5,
          def: "Feeling completely down and low in spirits, totally deflated",
        },
        {
          trigger: "tejate", word: "tejate", pos: "NOUN", lit: ["tejate"],
          delay: 0.7,
          def: "A cold Oaxacan drink of maize and cacao, foamy on top",
        },
      ],
      duration: 15,
    },
    // Iteracion 2: mismo molde, Buenos Aires.
    23: {
      screen: "reader", story: "pancho", theme: "light", bleed: 1.55,
      hook: ['A <i>pancho</i> is a hot dog.', 'It also means <span class="lime">relaxed.</span>'],
      sub: "Short narrated stories. Tap any word for its meaning.",
      glosses: [
        {
          trigger: "bajoneada", word: "bajoneado", pos: "ADJECTIVE",
          lit: ["bajoneada"], delay: 0.7, until: 8.5,
          def: "Feeling down and gloomy, with your spirits scraping the floor",
        },
        {
          trigger: "pancho", word: "pancho", pos: "ADJECTIVE", lit: ["pancho"],
          delay: 0.7,
          def: "Totally relaxed and unbothered, cool as a cucumber",
        },
      ],
      duration: 15,
    },
    // Plantilla 1 con la misma historia, para poder compararlas de verdad.
    21: {
      screen: "reader", story: "gato",
      hook: ['In Spain, empty is', '<span class="lime">&ldquo;not even the cat&rdquo;.</span>'],
      sub: "Short narrated stories. Tap any word for its meaning.",
      glosses: [
        {
          trigger: "gato", word: "ni el gato", pos: "EXPRESSION",
          litRange: [56 - 46, 58 - 46], delay: 0.6, until: 9.6,
          def: "Not a soul; nobody at all, not even the cat",
        },
        {
          trigger: "nadie", word: "a la hora de nadie", pos: "EXPRESSION",
          litRange: [72 - 46, 76 - 46], delay: 0.6,
          def: "At nobody's hour; at a time locals never choose",
        },
      ],
      duration: 15,
    },
    // El telefono ENTERO sobre la mesa: a sangre no se apoya en nada.
    20: {
      screen: "reader", story: "gato", theme: "desk", full: true,
      hook: ['In Spain, empty is', '<span class="lime">&ldquo;not even the cat&rdquo;.</span>'],
      sub: "Short narrated stories. Tap any word for its meaning.",
      glosses: [
        {
          trigger: "gato", word: "ni el gato", pos: "EXPRESSION",
          litRange: [56 - 46, 58 - 46], delay: 0.6, until: 9.6,
          def: "Not a soul; nobody at all, not even the cat",
        },
        {
          trigger: "nadie", word: "a la hora de nadie", pos: "EXPRESSION",
          litRange: [72 - 46, 76 - 46], delay: 0.6,
          def: "At nobody's hour; at a time locals never choose",
        },
      ],
      duration: 15,
    },
    // Mismo anuncio sobre un escritorio de madera generado con Flux.
    19: {
      screen: "reader", story: "gato", theme: "desk", bleed: 1.55,
      hook: ['In Spain, empty is', '<span class="lime">&ldquo;not even the cat&rdquo;.</span>'],
      sub: "Short narrated stories. Tap any word for its meaning.",
      glosses: [
        {
          trigger: "gato", word: "ni el gato", pos: "EXPRESSION",
          litRange: [56 - 46, 58 - 46], delay: 0.6, until: 9.6,
          def: "Not a soul; nobody at all, not even the cat",
        },
        {
          trigger: "nadie", word: "a la hora de nadie", pos: "EXPRESSION",
          litRange: [72 - 46, 76 - 46], delay: 0.6,
          def: "At nobody's hour; at a time locals never choose",
        },
      ],
      duration: 15,
    },
    // Angulo PISA 2025 (OCDE, 08/09/2026): la media de la OCDE marca su minimo
    // historico en lectura. Solo se afirma eso; el dato de EE. UU. no es
    // "record" y no sale. Mismo molde y misma historia que la 18.
    27: {
      screen: "reader", story: "gato", theme: "light", bleed: 1.55,
      hook: ['Reading scores just hit', 'a <span class="lime">record low.</span>'],
      sub: "Be the exception. In Spanish. (OECD, PISA 2025)",
      glosses: [
        {
          trigger: "gato", word: "ni el gato", pos: "EXPRESSION",
          litRange: [56 - 46, 58 - 46], delay: 0.6, until: 9.6,
          def: "Not a soul; nobody at all, not even the cat",
        },
        {
          trigger: "nadie", word: "a la hora de nadie", pos: "EXPRESSION",
          litRange: [72 - 46, 76 - 46], delay: 0.6,
          def: "At nobody's hour; at a time locals never choose",
        },
      ],
      duration: 15,
    },
    // España otra vez, con las dos expresiones mas raras de la ficha.
    18: {
      screen: "reader", story: "gato", theme: "light", bleed: 1.55,
      hook: ['In Spain, empty is', '<span class="lime">&ldquo;not even the cat&rdquo;.</span>'],
      // El subtitulo explica el producto, no adorna el titular.
      sub: "Short narrated stories. Tap any word for its meaning.",
      glosses: [
        {
          trigger: "gato", word: "ni el gato", pos: "EXPRESSION",
          litRange: [56 - 46, 58 - 46], delay: 0.6, until: 9.6,
          def: "Not a soul; nobody at all, not even the cat",
        },
        {
          trigger: "nadie", word: "a la hora de nadie", pos: "EXPRESSION",
          litRange: [72 - 46, 76 - 46], delay: 0.6,
          def: "At nobody's hour; at a time locals never choose",
        },
      ],
      duration: 15,
    },
    // La plantilla a sangre, con una historia que no habiamos usado: España.
    17: {
      screen: "reader", story: "barra", theme: "light", bleed: 1.55,
      hook: ['Ask for a menu in Spain.', 'There <span class="lime">isn&rsquo;t one.</span>'],
      sub: "Spanish from Spain, in the bar where you would need it.",
      glosses: [
        {
          trigger: "carta", word: "la carta", pos: "NOUN", lit: ["carta"],
          delay: 1.0, until: 5.5,
          def: "Menu; the printed list of dishes, which small bars rarely have",
        },
        {
          // La palabra suena a los 3,5 s; la tarjeta entra despues, cuando el
          // lector ya ha leido la frase entera y se para en ella.
          trigger: "barra", word: "la barra", pos: "NOUN", lit: ["barra"],
          delay: 2.5, until: 9.5,
          def: "Bar counter; in Spain you order and eat standing here",
        },
      ],
      duration: 15,
    },
    11: {
      screen: "reader", story: "spaeti",
      hook: ['This is German', '<span class="lime">nobody teaches you</span>.'],
      sub: "Berlin slang, learned inside a story.",
      glosses: [
        {
          trigger: "kiez", word: "der Kiez", pos: "NOUN", lit: ["kiez"],
          delay: 0.5, until: 6.3,
          def: "Berlin word for one's own neighborhood and its social life",
        },
        {
          trigger: "späti", word: "der Späti", pos: "NOUN", lit: ["späti"],
          delay: 0.55,
          def: "Berlin corner shop open late; drinks, snacks and gossip",
        },
      ],
      duration: 15,
    },
    // Practice: los cuatro ejercicios de la app, uno detras de otro, con la
    // historia del Lector que mejor funciono ("ni el gato").
    50: {
      screen: "practice4", theme: "light", phoneScale: 0.97,
      hook: ['You heard the story.', 'Now <span class="lime">make it stick.</span>'],
      duration: 16.8,
    },
    // Lector + Practice: la MISMA expresion en los dos sitios. Primero se oye
    // y se toca en la historia; luego la pantalla pasa a Practice y se usa.
    51: {
      screen: "combo", story: "gato", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['Your textbook forgot', '<span class="lime">the cat.</span>'],
      hook2: ['Get it wrong and you', '<span class="lime">eat alone at 1:30.</span>'],
      glosses: [
        {
          trigger: "gato", word: "ni el gato", pos: "EXPRESSION",
          litRange: [56 - 46, 58 - 46], delay: 0.6, until: 7.8,
          def: "Not a soul; nobody at all, not even the cat",
        },
      ],
      switchAt: 7.4, tap: 2.4, audioUntil: 6.6,
      duration: 12.6,
    },
    // Lector + Practice con otras historias y otros acentos. La expresion de
    // la tarjeta es la del ejercicio Meaning publicado de cada historia, con
    // sus cuatro opciones tal cual. La voz se apaga en el silencio MEDIDO tras
    // la frase (audioUntil y audioFade).
    52: {
      screen: "combo", story: "pedo", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['In Mexico, &ldquo;what fart&rdquo;', '<span class="lime">means hello.</span>'],
      hook2: ['Rude or friendly?', '<span class="lime">Pick fast.</span>'],
      glosses: [{
        trigger: "pedo", word: "qué pedo", pos: "EXPRESSION", litRange: [9, 10], delay: 0.5, until: 6.6,
        def: "What's up; a very common vulgar greeting among Mexican friends",
      }],
      practice: { word: "qué pedo", options: ["how much", "where to", "what's up", "who else"], correct: 2 },
      switchAt: 6.2, tap: 2.4, audioUntil: 5.25, audioFade: 0.15,
      duration: 10.6,
    },
    53: {
      screen: "combo", story: "comedera", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['Colombia has a word', '<span class="lime">for the munchies.</span>'],
      hook2: ['Hungry yet?', '<span class="lime">Prove you got it.</span>'],
      glosses: [{
        trigger: "comedera", word: "la comedera", pos: "NOUN", litRange: [17, 18], delay: 0.5, until: 8.4,
        def: "A strong sudden craving or urge to eat something",
      }],
      practice: { word: "la comedera", options: ["a deep fear of bugs", "a strong craving to eat", "a long lazy nap", "a sudden loss of appetite"], correct: 1 },
      switchAt: 8.0, tap: 2.4, audioUntil: 5.95, audioFade: 0.2,
      duration: 12.4,
    },
    54: {
      screen: "combo", story: "roche", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['Peruvians have a word', '<span class="lime">for pure cringe.</span>'],
      hook2: ['Skip the roche.', '<span class="lime">Get this one right.</span>'],
      glosses: [{
        trigger: "roche", word: "roche", pos: "NOUN", lit: ["roche"], delay: 0.6, until: 6.4,
        def: "Embarrassment or shame from an awkward humiliating moment",
      }],
      practice: { word: "roche", options: ["excitement", "embarrassment", "boredom", "comfort"], correct: 1 },
      switchAt: 6.0, tap: 2.4, audioUntil: 4.9, audioFade: 0.25,
      duration: 10.4,
    },
    55: {
      screen: "combo", story: "escoba", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['In Chile, a wild party', '<span class="lime">leaves a broom.</span>'],
      hook2: ['Party&rsquo;s over.', '<span class="lime">Now clean this up.</span>'],
      glosses: [{
        trigger: "escoba", word: "quedar la escoba", pos: "EXPRESSION", litRange: [14, 16], delay: 0.55, until: 7.6,
        def: "Here it turned out wild; usually a huge mess though",
      }],
      practice: { word: "quedar la escoba", options: ["it turned out wild", "it stayed totally calm", "it fell completely flat", "it ended really early"], correct: 0 },
      switchAt: 7.2, tap: 2.4, audioUntil: 5.1, audioFade: 0.3,
      duration: 11.6,
    },
    56: {
      screen: "combo", story: "embalada", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['Argentines don&rsquo;t fall in love.', '<span class="lime">They get packed.</span>'],
      hook2: ['Calm down, Romeo.', '<span class="lime">Pick the meaning.</span>'],
      glosses: [{
        trigger: "embalada", word: "embalado", pos: "ADJECTIVE", lit: ["embalada"], delay: 0.6, until: 12.2,
        def: "Carried away with excitement and rushing headlong into something",
      }],
      practice: { word: "embalado", options: ["dragging her feet", "bored out of her mind", "carried away with excitement", "angry and cold"], correct: 2 },
      switchAt: 11.8, tap: 2.4, audioUntil: 10.4, audioFade: 0.3,
      duration: 16.2,
    },
    // Redes (organico): el mismo Lector + Practice que la 54, con el ritmo de
    // Reels y TikTok. Aqui solo van los datos; el montaje (gancho en el
    // fotograma 0, zoom a la palabra, subtitulo, corte seco y bucle) vive en
    // socialScenes.js, que envuelve __ad.seek. Tiempos en reloj de ESTA escena.
    60: {
      screen: "combo", story: "roche", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['Peruvians have a word', '<span class="lime">for pure cringe.</span>'],
      hook2: ['Skip the roche.', '<span class="lime">Get this one right.</span>'],
      glosses: [{
        trigger: "roche", word: "roche", pos: "NOUN", lit: ["roche"], delay: 0.6, until: 99,
        def: "Embarrassment or shame from an awkward humiliating moment",
      }],
      practice: { word: "roche", options: ["excitement", "embarrassment", "boredom", "comfort"], correct: 1 },
      switchAt: 4.85, tap: 1.75, audioUntil: 4.9, audioFade: 0.25,
      duration: 9.6,
    },
    // Lector + Practice, Colombia. El saludo lo DICE Yamileth en la historia,
    // no lo narra nadie: es la diferencia que pedimos tras la 57 descartada.
    63: {
      screen: "combo", story: "quemas", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['Colombians greet you with', '<span class="lime">&ldquo;what more?&rdquo;</span>'],
      hook2: ['Answer wrong and', '<span class="lime">you sound like a tourist.</span>'],
      glosses: [{
        trigger: "más", word: "qué más", pos: "EXPRESSION", litRange: [13, 14], delay: 0.5, until: 11.25,
        def: "What else is new; the everyday Colombian hello",
      }],
      practice: { word: "qué más", options: ["what's new", "see you soon", "thanks a lot", "never mind"], correct: 0 },
      switchAt: 11.25, tap: 2.2, audioUntil: 11.1, audioFade: 0.22,
      // El lector se hacia lento en el feed: todo el anuncio va un 15% mas
      // rapido (imagen y voz a la vez, sin cambiar el tono).
      speed: 1.15,
      duration: 15.3,
    },
    // Lector + Practice, Chile. "Al tiro" sale en boca de Ignacio.
    64: {
      screen: "combo", story: "altiro", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['In Chile, &ldquo;at the shot&rdquo;', '<span class="lime">means right now.</span>'],
      hook2: ['The grease can wait.', '<span class="lime">This answer can&rsquo;t.</span>'],
      glosses: [{
        trigger: "tiro", word: "al tiro", pos: "EXPRESSION", litRange: [11, 12], delay: 0.45, until: 9.85,
        def: "Right away, immediately, in a flash without waiting",
      }],
      // Respaldo: si la historia trae su ejercicio publicado, manda ese.
      practice: { word: "al tiro", options: ["later on", "right away", "next year", "every week"], correct: 1 },
      // Un segundo largo de lectura despues de la voz, antes de Practice.
      // duration = switchAt + tap + 2.0 para que el acierto se vea.
      switchAt: 9.85, tap: 5.0, clock: true, audioUntil: 8.85, audioFade: 0.15,
      speed: 1.15,
      duration: 16.85,
    },
    // Lector + Practice, Mexico. La oferta del corredor, frase entera.
    65: {
      screen: "combo", story: "fiado", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['In Mexico a stranger lends you', '<span class="lime">200 on his word.</span>'],
      hook2: ['No contract, no card.', '<span class="lime">Just this phrase.</span>'],
      glosses: [{
        trigger: "f\u00edo", word: "dar fiado", pos: "EXPRESSION", litRange: [9, 9], delay: 0.4, until: 5.77,
        def: "To take it now and pay later, on trust",
      }],
      practice: {
        word: "dar fiado", sentence: "\u201cYo le [[f\u00edo]] los doscientos y me paga el domingo.\u201d",
        options: ["I owe you that much", "I charge you extra", "I lend it to you on trust", "I keep it for you"], correct: 2,
      },
      // Un segundo largo de lectura despues de la voz, antes de Practice.
      // duration = switchAt + tap + 2.0 de acierto en pantalla.
      switchAt: 5.77, tap: 5.0, clock: true, audioUntil: 4.77, audioFade: 0.15,
      speed: 1.15,
      duration: 12.77,
    },
    // Lector + Practice, Colombia (costa). Escena social: la parranda. El
    // fragmento 1 entero; tarjeta y ejercicio salen de la base.
    66: {
      screen: "combo", story: "sabroso", theme: "light", phoneScale: 0.97, practiceStep: 4,
      hook: ['Colombians don&rsquo;t dance well.', '<span class="lime">They dance &ldquo;tasty.&rdquo;</span>'],
      hook2: ['Your move.', '<span class="lime">Don&rsquo;t blow it.</span>'],
      glosses: [{
        trigger: "sabroso", word: "bailar sabroso", pos: "EXPRESSION", litRange: [10, 11], delay: 0.45, until: 7.27,
        def: "to dance with great flavor and easy natural rhythm",
      }],
      practice: { word: "bailar sabroso", options: ["dancing with real flavor", "standing totally still", "tripping over herself", "sitting off to the side"], correct: 0 },
      // duration = switchAt + tap + 2.0 para que el acierto se vea.
      // El segmento de la narracion acaba en 14,86 s, pero ahi ya suena el
      // "Ahi" de la frase siguiente: el silencio real va de 14,30 a 14,82 y el
      // corte cae en medio (14,55 = 6,27 s de escena).
      switchAt: 7.27, tap: 5.0, clock: true, audioUntil: 6.27, audioFade: 0.1,
      speed: 1.15,
      duration: 14.27,
    },
    /* 67: tour de variantes. Cuatro paises en el MISMO lector, una oracion
     * entera cada uno, sin ejercicio. Cada pais se renderiza como su propia
     * pieza (671-674) y el montaje las pega con corte seco (_tourVar.ts): el
     * titular no se mueve, asi que lo unico que cambia es la historia, la
     * bandera y el acento. La ultima (675) es el catalogo.
     *
     * Los cortes de audio van medidos en el mp3, no por el alineado; ver el
     * comentario de las ventanas "v*" en buildStories.ts. */
    671: {
      screen: "reader", story: "vmx", theme: "light", phoneScale: 0.97, tour: true,
      hook: ['&ldquo;Spanish&rdquo; is not', '<span class="lime">one language.</span>'],
      sub: '<span class="adFlagRow">' + flag("MX", 22) + "MEXICO</span>",
      glosses: [{ trigger: "qué", word: "qué pedo", pos: "EXPRESSION", litRange: [0, 1], delay: 0.95, def: "what's up" }],
      audioUntil: 2.24, audioFade: 0.12, duration: 2.56,
    },
    672: {
      screen: "reader", story: "var", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['&ldquo;Spanish&rdquo; is not', '<span class="lime">one language.</span>'],
      sub: '<span class="adFlagRow">' + flag("AR", 22) + "ARGENTINA</span>",
      glosses: [{ trigger: "horno", word: "horno", pos: "EXPRESSION", litRange: [3, 3], delay: 0.4, def: "in deep trouble" }],
      audioUntil: 2.79, audioFade: 0.12, duration: 3.11,
    },
    673: {
      screen: "reader", story: "vco", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['&ldquo;Spanish&rdquo; is not', '<span class="lime">one language.</span>'],
      sub: '<span class="adFlagRow">' + flag("CO", 22) + "COLOMBIA</span>",
      glosses: [{ trigger: "juemadre", word: "juemadre", pos: "EXPRESSION", litRange: [1, 1], delay: 0.35, def: "damn it" }],
      audioUntil: 3.02, audioFade: 0.12, duration: 3.34,
    },
    674: {
      screen: "reader", story: "ves", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['&ldquo;Spanish&rdquo; is not', '<span class="lime">one language.</span>'],
      sub: '<span class="adFlagRow">' + flag("ES", 22) + "SPAIN</span>",
      glosses: [{ trigger: "cumpleañero", word: "cumpleañero", pos: "NOUN", litRange: [5, 5], delay: 0.05, def: "the birthday person" }],
      audioUntil: 3.28, audioFade: 0.12, duration: 3.6,
    },
    675: {
      screen: "catalog", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true, catalogLang: "es",
      hook: ['One app.', '<span class="lime">Every Spanish.</span>'],
      sub: "Stories written and voiced where they are set.",
      duration: 2.2,
    },
    /* 68: segundo tour de variantes. Otras cuatro historias, otro titular y
     * otro cierre. Mismo montaje que el 67 (_tourVar.ts --ad 68). */
    681: {
      screen: "reader", story: "wco", theme: "light", phoneScale: 0.97, tour: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("CO", 22) + "COLOMBIA</span>",
      glosses: [{ trigger: "rumba", word: "rumba", pos: "NOUN", litRange: [1, 1], delay: 0.35, def: "a party" }],
      audioUntil: 2.94, audioFade: 0.12, duration: 3.12,
    },
    682: {
      screen: "reader", story: "wmx", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("MX", 22) + "MEXICO</span>",
      glosses: [{ trigger: "mamada", word: "mamada", pos: "NOUN", litRange: [1, 1], delay: 0.35, def: "nonsense, rubbish" }],
      audioUntil: 2.88, audioFade: 0.12, duration: 3.06,
    },
    683: {
      screen: "reader", story: "war", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("AR", 22) + "ARGENTINA</span>",
      glosses: [{ trigger: "previa", word: "previa", pos: "NOUN", litRange: [1, 1], delay: 0.45, def: "the warm-up gathering before going out" }],
      audioUntil: 3.56, audioFade: 0.12, duration: 3.74,
    },
    684: {
      screen: "reader", story: "wes", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("ES", 22) + "SPAIN</span>",
      glosses: [{ trigger: "sobremesa", word: "sobremesa", pos: "NOUN", litRange: [1, 1], delay: 0.35, def: "the long talk that keeps everyone at the table after a meal" }],
      audioUntil: 2.66, audioFade: 0.12, duration: 3.34,
    },
    685: {
      screen: "catalog", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true, catalogLang: "es",
      hook: ['One app.', '<span class="lime">Every accent.</span>'],
      sub: "Stories written and voiced where they are set.",
      duration: 1.6,
    },
    /* 69: cuatro paises otra vez, con palabras que no salen ni en la 67 ni en
     * la 68, y en otro orden (Espana, Colombia, Mexico, Argentina). */
    691: {
      screen: "reader", story: "xes", theme: "light", phoneScale: 0.97, tour: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("ES", 22) + "SPAIN</span>",
      // La frase ocupa dos lineas: la tarjeta espera a que se lea entera.
      glosses: [{ trigger: "caña", word: "caña", pos: "NOUN", litRange: [5, 5], delay: 0.7, def: "a small draught beer" }],
      audioUntil: 2.92, audioFade: 0.12, duration: 3.5,
    },
    692: {
      screen: "reader", story: "yco", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("CO", 22) + "COLOMBIA</span>",
      glosses: [{ trigger: "berraco", word: "berraco", pos: "ADJECTIVE", litRange: [2, 2], delay: 0.3, def: "brilliant, wild, amazing" }],
      audioUntil: 1.6, audioFade: 0.12, duration: 2.45,
    },
    693: {
      screen: "reader", story: "ymx", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("MX", 22) + "MEXICO</span>",
      glosses: [{ trigger: "ofrenda", word: "ofrenda", pos: "NOUN", litRange: [3, 3], delay: 0.35, def: "the altar built for the dead" }],
      audioUntil: 3.74, audioFade: 0.12, duration: 3.95,
    },
    694: {
      screen: "reader", story: "xar", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("AR", 22) + "ARGENTINA</span>",
      glosses: [{ trigger: "chamuyero", word: "chamuyero", pos: "NOUN", litRange: [1, 1], delay: 0.2, def: "a smooth talker" }],
      audioUntil: 3.5, audioFade: 0.12, duration: 3.68,
    },
    695: {
      screen: "catalog", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true, catalogLang: "es",
      hook: ['One app.', '<span class="lime">Every accent.</span>'],
      sub: "Stories written and voiced where they are set.",
      duration: 1.3,
    },
    /* 70: cuatro paises, ninguno repetido con 67-69, y entra Peru. */
    701: {
      screen: "reader", story: "zpe", theme: "light", phoneScale: 0.97, tour: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("PE", 22) + "PERU</span>",
      glosses: [{ trigger: "chifa", word: "chifa", pos: "NOUN", litRange: [2, 2], delay: 0.35, def: "a Chinese-Peruvian restaurant" }],
      audioUntil: 3.34, audioFade: 0.12, duration: 3.7,
    },
    702: {
      screen: "reader", story: "zco", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("CO", 22) + "COLOMBIA</span>",
      glosses: [{ trigger: "man", word: "el man", pos: "NOUN", litRange: [1, 1], delay: 0.35, def: "the guy" }],
      audioUntil: 3.48, audioFade: 0.12, duration: 3.84,
    },
    703: {
      screen: "reader", story: "zar", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("AR", 22) + "ARGENTINA</span>",
      glosses: [{ trigger: "macana", word: "macana", pos: "SLANG", litRange: [1, 1], delay: 0.3, def: "a mess, a blunder" }],
      audioUntil: 1.5, audioFade: 0.12, duration: 2.6,
    },
    704: {
      screen: "reader", story: "zes", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("ES", 22) + "SPAIN</span>",
      glosses: [{ trigger: "ronda", word: "ronda", pos: "NOUN", litRange: [2, 2], delay: 0.35, def: "a round of drinks for everyone" }],
      audioUntil: 2.92, audioFade: 0.12, duration: 3.3,
    },
    705: {
      screen: "catalog", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true, catalogLang: "es",
      hook: ['One app.', '<span class="lime">Every accent.</span>'],
      sub: "Stories written and voiced where they are set.",
      duration: 1.5,
    },
    /* 71: tres paises, con Barranquilla y Lima. Mas corto a proposito: no hay
     * material limpio para una cuarta pieza sin repetir palabra. */
    711: {
      screen: "reader", story: "yco2", theme: "light", phoneScale: 0.97, tour: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("CO", 22) + "COLOMBIA</span>",
      glosses: [{ trigger: "marimondas", word: "marimonda", pos: "NOUN", litRange: [2, 2], delay: 0.3, def: "the long-nosed carnival mask of Barranquilla" }],
      audioUntil: 1.96, audioFade: 0.12, duration: 3.0,
    },
    712: {
      screen: "reader", story: "ype", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("PE", 22) + "PERU</span>",
      glosses: [{ trigger: "mozo", word: "mozo", pos: "NOUN", litRange: [1, 1], delay: 0.35, def: "the waiter" }],
      audioUntil: 3.36, audioFade: 0.12, duration: 3.72,
    },
    713: {
      screen: "reader", story: "yar", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true,
      hook: ['You learned &ldquo;Spanish&rdquo;.', '<span class="lime">Now learn how they talk.</span>'],
      sub: '<span class="adFlagRow">' + flag("AR", 22) + "ARGENTINA</span>",
      glosses: [{ trigger: "pomo", word: "pomo", pos: "EXPRESSION", litRange: [8, 8], delay: 0.25, def: "not a thing, nothing at all" }],
      audioUntil: 2.1, audioFade: 0.12, duration: 3.1,
    },
    714: {
      screen: "catalog", theme: "light", phoneScale: 0.97, tour: true, noEntrance: true, catalogLang: "es",
      hook: ['One app.', '<span class="lime">Every accent.</span>'],
      sub: "Stories written and voiced where they are set.",
      duration: 1.5,
    },
    // Redes, formatos propios (socialFormats.js pinta y cronometra todo; aqui
    // solo hace falta una escena valida para que la pagina arranque).
    61: { screen: "reader", story: "gato", hook: ["", ""], duration: 1 },
    62: { screen: "reader", story: "gato", hook: ["", ""], duration: 1 },
  };
  const S = SCENES[SCENE];
  const STORY = S.story ? STORIES[S.story] : null;
  const TL = !STORY ? null
    : STORY.words ? { words: STORY.words, duration: STORY.words[STORY.words.length - 1].e }
    : build(STORY);
  const WORDS = TL ? TL.words : [];
  /** Con audio real, la barra marca el minuto de VERDAD de la historia. */
  const REAL = !!(STORY && STORY.words);

  /* ---------------- pantallas ---------------- */
  function statusBar(clock) {
    return (
      '<div class="phoneNotch"></div>' +
      '<div class="phoneStatus"><span>' + clock + '</span>' +
      '<div class="statusIcons">' + ICON.wifi + ICON.battery + "</div></div>"
    );
  }

  function readerScreen() {
    /** Una palabra, con su puntuacion pegada. */
    function tok(i, withPost) {
      const w = WORDS[i];
      const mark = ' data-i="' + i + '">';
      return (w.pre ? '<span class="wp"' + mark + w.pre + "</span>" : "") +
        '<span class="w"' + mark + w.t + "</span>" +
        (withPost && w.post ? '<span class="wp"' + mark + w.post + "</span>" : "");
    }

    let body = "";
    let i = 0;
    while (i < WORDS.length) {
      if (WORDS[i].br) body += '<span class="paraBreak"></span>';
      const kind = WORDS[i].kind;
      if (!kind) {
        body += tok(i, true) + " ";
        i++;
        continue;
      }
      // Palabras seguidas del mismo tipo: una sola tirada de vocabulario.
      let j = i;
      while (j + 1 < WORDS.length && WORDS[j + 1].kind === kind && !WORDS[j + 1].br) j++;
      const last = WORDS[j];
      body += '<span class="' + runClass(kind) + '" data-a="' + i + '" data-b="' + j + '">';
      for (let n = i; n <= j; n++) body += tok(n, n < j) + (n < j ? " " : "");
      body += "</span>" +
        (last.post ? '<span class="wp" data-i="' + j + '">' + last.post + "</span>" : "") + " ";
      i = j + 1;
    }
    return (
      '<div class="phoneScreen">' +
        '<div class="readerHeaderRow">' +
          '<button class="iconBtnRound">' + ICON.back + "</button>" +
          '<div class="readerHeaderActions">' +
            '<button class="iconBtnRound">' + ICON.save + "</button>" +
            '<button class="iconBtnRound">' + ICON.down + "</button>" +
          "</div>" +
        "</div>" +
        '<h3 class="readerTitleCentered" id="dimA">' + STORY.title + "</h3>" +
        '<div class="coverWarm" id="dimB"><img class="coverImage" src="' + STORY.cover +
          '" alt="" style="position:absolute;inset:0;width:100%;height:100%"/></div>' +
        '<div class="readerBody" id="storyBody"><div id="storyInner">' + body +
          (STORY && STORY.after
            ? STORY.after.map(function (p) { return '<span class="wTail">' + p + "</span>"; }).join("")
            : "") + "</div></div>" +
        '<div class="vocabPanel" id="panel" style="opacity:0">' +
          '<div class="vocabPanelWord" id="panelWord"></div>' +
          '<span class="vocabPosSky" id="panelPos"></span>' +
          '<p class="vocabPanelDef" id="panelDef"></p>' +
          '<button class="vocabSaveBtn">' + ICON.heart + "Save word</button>" +
        "</div>" +
        '<div class="audioBar">' +
          '<div class="audioScrub">' +
            '<span class="audioTs" id="ts">0:00</span>' +
            '<div class="audioTrack"><div class="audioFill" id="fill"></div><div class="audioHandle" id="handle"></div></div>' +
            '<span class="audioTs">' + fmt(STORY.total) + "</span>" +
          "</div>" +
          '<div class="audioControls">' +
            '<button class="audioSkip">' + ICON.back10 + '<span class="audioSkipLabel">10</span></button>' +
            '<button class="audioPlay">' + ICON.pause + "</button>" +
            '<button class="audioSkip">' + ICON.fwd10 + '<span class="audioSkipLabel">10</span></button>' +
            '<button class="audioSpeed">1x' + ICON.chevUp + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  const OPTIONS = [
    { color: "yellow", text: "A bag carried over the shoulder when going to the market." },
    { color: "blue", text: "The deep back or bottom of a clay cooking pot." },
    { color: "purple", text: "A short morning prayer said before breakfast." },
    { color: "green", text: "A small, family-run Mexican restaurant serving home-style food." },
  ];
  const CORRECT = 3;

  function practiceScreen() {
    let steps = "";
    for (let i = 0; i < 8; i++) steps += '<span class="wqStep' + (i === 0 ? " wqStepDone" : "") + '"></span>';
    let cards = "";
    OPTIONS.forEach(function (o, i) {
      cards += '<div class="wqCard" data-card="' + i + '">' +
        '<span class="wqAccent wqAccent_' + o.color + '"></span>' +
        '<p class="wqCardText">' + o.text + "</p></div>";
    });
    return (
      '<div class="phoneScreen">' +
        '<div class="wqHeader">' +
          '<button class="wqBack">' + ICON.back + "</button>" +
          '<div class="wqTitleCol"><span class="wqKicker">WORD QUEST</span><h2 class="wqTitle">Meaning</h2></div>' +
          '<span class="wqTimer" id="wqTimer">7s</span>' +
        "</div>" +
        '<div class="wqProgress"><div class="wqProgressFill" id="wqFill"></div></div>' +
        '<div class="wqSteps">' + steps + "</div>" +
        '<div class="wqTags">' +
          '<span class="wqTagQuest"><span class="wqTagDot"></span>WORD QUEST</span>' +
          '<span class="wqTagSpacer"></span>' +
          '<span class="wqTagXp">' + ICON.bolt + "+6</span>" +
          '<span class="wqTagGem">' + ICON.gem + "1</span>" +
        "</div>" +
        '<p class="wqQuestion">What does this word mean?</p>' +
        '<div class="wqWordRow"><h1 class="wqWord">fonda</h1><button class="wqAudio">' + ICON.speaker + "</button></div>" +
        '<div class="wqUnderline"></div>' +
        '<div class="wqGrid">' + cards + '<div class="wqCursor" id="wqCursor">' + ICON.cursor + "</div></div>" +
        '<div class="wqBottom"><button class="wqBtnDisabled" id="wqBtn">PICK AN ANSWER</button></div>' +
      "</div>"
    );
  }


  /* ---------------- Practice: los cuatro ejercicios ----------------
   * Datos REALES del set de practica de "A las dos no cabe nadie" (la
   * historia del anuncio Lector de "ni el gato"): Meaning y Context salen
   * tal cual del set publicado; Listening y Match usan su vocabulario, que es
   * como la app los arma. Se ven como en el movil (src/app/practice). */
  const P4 = {
    segs: [
      { mode: "meaning", start: 0.3, kicker: "WORD QUEST", title: "Meaning", color: "#fbbf24", timer: 15 },
      { mode: "context", start: 4.1, kicker: "SENTENCE RUN", title: "Context", color: "#34d399", timer: 15 },
      { mode: "listening", start: 7.9, kicker: "SOUND CHECK", title: "Listening", color: "#e879f9", timer: 15 },
      { mode: "match", start: 11.7, kicker: "RAPID PAIRS", title: "Match", color: "#22d3ee", timer: 20 },
    ],
    meaning: { word: "ni el gato", options: ["the whole town", "only the owner", "not a soul", "half the street"], correct: 2, tap: 1.9 },
    context: {
      before: "El comedor está tan lleno que no ", after: " una silla más.",
      tBefore: "The dining room is so full that not one more chair ", tAfter: ".",
      options: ["pesa", "cabe", "huele", "suena"], correct: 1, answerEn: "fits", tap: 2.0,
    },
    listening: { options: ["guiso", "comedor", "cubo", "hambre"], correct: 3, play: 0.6, tap: 2.6 },
    match: {
      words: ["comedor", "guiso", "fregona", "cubo"],
      meanings: ["a stew", "a bucket", "a dining room", "a mop"],
      answer: [2, 0, 3, 1],
      colors: ["#38bdf8", "#34d399", "#fcd34d", "#e879f9"],
      first: 0.55, step: 0.82, gap: 0.38,
    },
    slide: 0.35,
  };

  function p4Screen() {
    let steps = "";
    for (let i = 0; i < 8; i++) steps += '<span class="wqStep" data-step="' + i + '"></span>';
    const ACC = ["yellow", "blue", "purple", "green"];
    function grid(id, options, cls) {
      return '<div class="p4Grid" id="' + id + '">' + options.map(function (o, i) {
        return '<div class="p4Opt ' + cls + '" data-i="' + i + '"><span class="wqAccent wqAccent_' + ACC[i] + '"></span>' +
          '<span class="p4Check">' + ICON.check + "</span><span class=\"p4OptText\">" + o + "</span></div>";
      }).join("") + "</div>";
    }
    const M = P4.meaning, C = P4.context, L = P4.listening, X = P4.match;
    let pairs = "";
    for (let i = 0; i < 4; i++) {
      pairs += '<div class="p4Pair p4Word" data-w="' + i + '"><span class="p4PairText">' + X.words[i] + "</span></div>" +
        '<div class="p4Pair p4Mean" data-m="' + i + '"><span class="p4PairText">' + X.meanings[i] + "</span></div>";
    }
    return (
      '<div class="phoneScreen">' +
        '<div class="wqHeader">' +
          '<button class="wqBack">' + ICON.back + "</button>" +
          '<div class="wqTitleCol"><span class="wqKicker" id="p4Kicker"></span><h2 class="wqTitle" id="p4Title"></h2></div>' +
          '<span class="wqTimer" id="p4Timer"></span>' +
        "</div>" +
        '<div class="wqProgress"><div class="wqProgressFill" id="p4Fill"></div></div>' +
        '<div class="wqSteps">' + steps + "</div>" +
        '<div class="wqTags">' +
          '<span class="wqTagQuest"><span class="wqTagDot"></span><span id="p4Tag">WORD QUEST</span></span>' +
          '<span class="wqTagSpacer"></span>' +
          '<span class="wqTagXp">' + ICON.bolt + '<span id="p4Xp">+0</span></span>' +
          '<span class="wqTagGem">' + ICON.gem + "1</span>" +
        "</div>" +
        '<div class="p4Stage" id="p4Stage">' +
          '<div class="p4Layer" data-layer="0">' +
            '<p class="wqQuestion">What does this word mean?</p>' +
            '<div class="wqWordRow"><h1 class="wqWord p4Word3">' + M.word + '</h1><button class="wqAudio">' + ICON.speaker + "</button></div>" +
            '<div class="wqUnderline"></div>' +
            // La frase de la historia, como en la app: sin ella, la opcion en
            // primera persona parece la definicion del lema y no lo es.
            grid("p4g0", M.options, "p4OptDef") +
          "</div>" +
          '<div class="p4Layer" data-layer="1">' +
            '<p class="wqQuestion">Complete the sentence.</p>' +
            '<div class="p4Sentence"><p class="p4SentText">' + C.before + '<span class="p4Blank" id="p4Blank">_____</span>' + C.after + "</p></div>" +
            '<p class="p4Trans">' + C.tBefore + '<span class="p4TBlank" id="p4TBlank">___</span>' + C.tAfter + "</p>" +
            grid("p4g1", C.options, "p4OptWord") +
          "</div>" +
          '<div class="p4Layer" data-layer="2">' +
            '<div class="p4Listen"><div class="p4Wave" id="p4Wave1"></div><div class="p4Wave" id="p4Wave2"></div>' +
              '<button class="p4Play" id="p4Play">' + ICON.speaker + "</button></div>" +
            '<p class="p4ListenLabel" id="p4ListenLabel">TAP TO LISTEN</p>' +
            grid("p4g2", L.options, "p4OptWord") +
          "</div>" +
          '<div class="p4Layer" data-layer="3">' +
            '<p class="wqQuestion">Tap a word, then its meaning.</p>' +
            '<div class="p4MatchHead"><span>WORDS</span><span>MEANINGS</span></div>' +
            '<div class="p4Match" id="p4Match">' + pairs + "</div>" +
          "</div>" +
        "</div>" +
        '<div class="wqBottom"><button class="wqBtnDisabled" id="p4Btn">PICK AN ANSWER</button></div>' +
      "</div>"
    );
  }

  /* Solo journeys PUBLICADOS: un anuncio no enseña borradores. */
  const IMG = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/images/";
  const CATALOG = [
    ["Xochimilco en trajinera", "MX", "A0", "Mexico City", IMG + "cmrrqjdgq000232nvx341oajg-cel-clean-2617218.png"],
    ["Marta enseña el Retiro", "ES", "A0", "Madrid", IMG + "marta-ensena-el-retiro-spaina0-2564324.png"],
    ["O acarajé de Célia", "BR", "A0", "Salvador", IMG + "o-acaraje-de-celia-2501524.png"],
    ["Onces con Ruana", "CO", "C1", "Bogotá", IMG + "onces-con-ruana-styleB-flux-1784391416565.png"],
    ["El salmorejo se acaba primero", "ES", "A1", "Córdoba", IMG + "el-salmorejo-se-acaba-primero-a1spain-2395044.png"],
    ["Due baci e basta", "IT", "A0", "Rome", IMG + "due-baci-e-basta-2660222.png"],
    ["Una foto y un pañuelo", "MX", "A0", "Mexico City", IMG + "cmrrqjdr0000432nvc0mt64ni-cel-clean-2652428.png"],
    ["Ciclovía y Tejo", "CO", "C1", "Bogotá", IMG + "ciclov-a-y-tejo-styleB-flux-1784391323747.png"],
    ["Der Späti in der Weserstraße", "DE", "C1", "Berlin", IMG + "der-sp-ti-in-der-weserstra-e-custom-flux-1783587258766.png"],
    ["A capa de dez reais", "BR", "A1", "Rio de Janeiro", IMG + "a-capa-de-dez-reais-styleB-flux-1787135591552.png"],
    ["Todos le llenan el cesto", "ES", "A2", "Galicia", IMG + "cmt70xgax000p3283qt04e0zg-cel-clean-2144797.png"],
    ["I gradini non finiscono mai", "IT", "A0", "Rome", IMG + "i-gradini-non-finiscono-mai-2916143.png"],
  ];

  function catalogScreen() {
    /* catalogLang: el cierre del tour de variantes promete espanol, asi que el
     * catalogo va filtrado como lo filtraria el usuario: el chip de Spanish
     * encendido y solo historias en espanol. Ensenar un journey aleman debajo
     * de "Every Spanish" seria enseñar otra cosa de la que se dice. */
    const ES_ONLY = ["ES", "MX", "CO", "AR", "PE", "CL"];
    const chips = [
      ["All languages", S.catalogLang !== "es"], ["Spanish", S.catalogLang === "es"],
      ["Portuguese", false], ["Italian", false], ["German", false],
    ].map(function (c) {
      return '<span class="adChip' + (c[1] ? " adChipOn" : "") + '">' + c[0] + "</span>";
    }).join("");
    const rows = S.catalogLang === "es"
      ? CATALOG.filter(function (c) { return ES_ONLY.indexOf(c[1]) !== -1; })
      : CATALOG;
    const cards = rows.map(function (c) {
      return '<div class="adCard">' +
        '<img class="adCardImg" src="' + c[4] + '" alt=""/>' +
        '<div class="adCardBody"><div class="adCardTitle">' + c[0] + "</div>" +
        '<div class="adCardMeta">' + flag(c[1], 13) +
        '<span class="adLevel">' + c[2] + "</span>" +
        '<span class="adPlace">' + c[3] + "</span></div></div></div>";
    }).join("");
    return (
      '<div class="adCat">' +
        '<div class="adCatTop"><h3 class="adCatTitle">Explore</h3><span class="adCatCount">' + ICON.search + "</span></div>" +
        '<div class="adChips">' + chips + "</div>" +
        '<div class="adGridWrap"><div class="adGrid" id="catGrid">' + cards + "</div></div>" +
      "</div>"
    );
  }

  /**
   * B y C ensenan la historia SIN el marco del telefono: las mismas palabras
   * y los mismos tiempos, a un tamano que se lee de un vistazo en el movil.
   */
  function bareScreen(kind) {
    let body = "";
    WORDS.forEach(function (w, i) {
      if (w.br) body += '<span class="bBreak"></span>';
      body += (w.pre || "") + '<span class="bw" data-i="' + i + '">' + w.t + "</span>" +
        (w.post || "") + " ";
    });
    const text = '<div class="bText" id="bigText">' + body + "</div>";
    const art = kind === "cover"
      ? '<div class="bArtBox"><img class="bArt" src="' + STORY.cover + '" alt=""/>' +
        '<div class="bScrim"></div>' + text + "</div>"
      : '<div class="bMeta"><img class="bMetaArt" src="' + STORY.cover + '" alt=""/>' +
        '<div><div class="bMetaTitle">' + STORY.title + "</div>" +
        '<div class="bMetaSub">Digital Polyglot</div></div></div>';
    return (
      '<div class="bWrap">' + art +
        (kind === "cover" ? "" : text) +
        '<div class="bCard" id="bCard" style="opacity:0">' +
          '<div class="bCardWord" id="bCardWord"></div>' +
          '<span class="bCardPos" id="bCardPos"></span>' +
          '<p class="bCardDef" id="bCardDef"></p>' +
        "</div>" +
        '<div class="bBar"><div class="bBarFill" id="bBarFill"></div></div>' +
      "</div>"
    );
  }

  /* Lector + Practice: las dos pantallas en el mismo telefono, una encima de
   * otra. Practice solo trae Meaning, con la expresion que abrio la tarjeta. */
  function comboScreen() {
    P4.segs = [Object.assign({}, P4.segs[0], { start: S.switchAt })];
    P4.meaning.tap = S.tap;
    if (S.practice) {
      P4.meaning.word = S.practice.word;
      P4.meaning.options = S.practice.options;
      P4.meaning.correct = S.practice.correct;
      /* Si la historia trae su ejercicio publicado, manda ese: mismas opciones
       * y mismo orden que sirve la API al movil. La escena solo es respaldo. */
      const real = STORY && STORY.practice ? STORY.practice[S.practice.word.toLowerCase()] : null;
      if (real && real.correct >= 0) {
        P4.meaning.word = real.word;
        P4.meaning.options = real.options;
        P4.meaning.correct = real.correct;
      }
    }
    return '<div class="comboLayer" id="comboA">' + readerScreen() + "</div>" +
      '<div class="comboLayer" id="comboB">' + p4Screen() + "</div>";
  }

  /* ---------------- montaje ---------------- */
  const screenHTML =
    S.screen === "reader" ? readerScreen() :
    S.screen === "practice" ? practiceScreen() :
    S.screen === "practice4" ? p4Screen() :
    S.screen === "combo" ? comboScreen() : catalogScreen();
  const clock = S.screen === "practice" || S.screen === "practice4" ? "13:55" : "9:41";

  const root = document.getElementById("root");
  if (S.theme === "light") root.classList.add("adLight");
  if (S.theme === "desk") root.classList.add("adLight", "adDesk");
  /** Lector que avanza solo: sin titulo ni portada, con el texto corriendo. */
  /* En 4:5 hay mucha menos altura: con el mismo zoom, la tarjeta se comia el
   * reproductor. El aparato se sale igual, pero menos. */
  const BLEED = S.bleed ? (RATIO === "45" ? Math.round(S.bleed * 75) / 100 : S.bleed) : 0;
  const SCROLLREAD = !!(S.bleed || S.full);
  if (SCROLLREAD) root.classList.add("adScroll");
  if (S.bleed) root.classList.add("adBleed");
  if (S.layout === "type") root.classList.add("layType");
  if (S.layout === "cover") root.classList.add("layCover");
  if (BLEED) R.setProperty("--scale", String(BLEED));
  if (S.phoneScale) R.setProperty("--scale", String(RATIO === "45" ? Math.round(S.phoneScale * 72) / 100 : S.phoneScale));
  /* Lector + Practice en 4:5: con el 72% el lector quedaba ilegible en el
   * feed y sobraban 110 px abajo. El telefono crece hasta casi el borde y el
   * titular sube de cuerpo. Solo toca a "combo"; el resto de 4:5 no cambia. */
  if (RATIO === "45" && (S.screen === "combo" || S.tour)) {
    R.setProperty("--scale", "0.80");
    R.setProperty("--phoneTop", "18px");
    R.setProperty("--hookSize", "34px");
  }
  if (RATIO === "45") root.classList.add("ratio45");

  /* hook2: el titular cambia con el paso (Lector arriba, Practice despues). */
  const headHTML =
    '<div class="adHead' + (S.hook2 ? " hasHook2" : "") + '" id="head">' +
      '<h1 class="adHook" id="hookA">' + S.hook[0] + "<br/>" + S.hook[1] + "</h1>" +
      (S.hook2 ? '<h1 class="adHook" id="hookB" style="opacity:0">' + S.hook2[0] + "<br/>" + S.hook2[1] + "</h1>" : "") +
      (S.sub ? '<p class="adSub">' + S.sub + "</p>" : "") +
    "</div>";

  root.innerHTML = S.layout
    ? headHTML + bareScreen(S.layout)
    : headHTML +
      '<div class="adPhoneWrap"><div class="phoneScaler"><div class="phone" id="phone">' +
        statusBar(clock) + screenHTML +
        '<div class="adTapRing" id="ring" style="opacity:0"></div>' +
      "</div></div></div>";

  const el = {
    head: document.getElementById("head"),
    ring: document.getElementById("ring"),
    phone: document.getElementById("phone"),
  };
  const tokens = Array.prototype.slice.call(document.querySelectorAll("#storyBody .w"));
  const bareTokens = Array.prototype.slice.call(document.querySelectorAll("#bigText .bw"));
  /** Comillas, comas y puntos: van fuera de la pastilla, pero se atenuan con
   *  su palabra. Sueltos se quedaban encendidos sobre el texto apagado. */
  const puncts = Array.prototype.slice.call(document.querySelectorAll("#storyBody .wp"));
  const runs = Array.prototype.slice.call(document.querySelectorAll("#storyBody .vrun"));
  const geo = tokens.map(function (n) {
    return { top: n.offsetTop, left: n.offsetLeft, w: n.offsetWidth, h: n.offsetHeight };
  });
  const bodyEl = document.getElementById("storyBody");
  const BODY_TOP = bodyEl ? bodyEl.offsetTop : 0;
  /** Linea en la que se queda la palabra que suena, dentro del cuerpo. */
  const ANCHOR = 44;

  /* A sangre, el reproductor se sube al borde de lo que SE VE del telefono:
   * anclado al fondo del aparato caeria fuera de cuadro y dejaria el hueco
   * vacio que ya nos comimos una vez. */
  let BAR_TOP = 0;
  if (SCROLLREAD) {
    const bar = document.querySelector(".audioBar");
    const phoneEl = document.getElementById("phone");
    if (bar && phoneEl) {
      if (S.bleed) {
        // A sangre el reproductor se sube al borde de lo que SE VE.
        const visible = (GEO.h - phoneEl.getBoundingClientRect().top) / BLEED;
        BAR_TOP = Math.max(200, visible - 12 - bar.offsetHeight);
        bar.style.bottom = "auto";
        bar.style.top = BAR_TOP + "px";
      } else {
        // Con el telefono entero a la vista se queda donde va siempre.
        BAR_TOP = bar.offsetTop;
      }
    }
  }

  function easeOut(x) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3); }

  function entrance(t) {
    const a = easeOut(t / 0.5);
    el.head.style.opacity = String(a);
    el.head.style.transform = "translateY(" + (1 - a) * 16 + "px)";
  }

  /* Karaoke, barra de audio y tarjeta de vocabulario. */
  function reader(t) {
    const time = Math.min(t, TL.duration);
    let active = -1;
    for (let i = 0; i < WORDS.length; i++) {
      if (time >= WORDS[i].s && time < WORDS[i].e) { active = i; break; }
    }

    /* Dos formas de abrir la tarjeta, y las dos acaban en el mismo objeto:
     * `taps`, un dedo que toca la palabra; y `gloss`, la tarjeta que se abre
     * SOLA cuando la narracion llega a la palabra. */
    const taps = S.taps || [];
    let open = null, ring = null;
    taps.forEach(function (tap, k) {
      const end = k + 1 < taps.length ? taps[k + 1].at - 0.45 : S.duration + 1;
      const idx = WORDS.findIndex(function (w) { return w.t === tap.word; });
      const g = GLOSSES[tap.word];
      if (t >= tap.at - 0.5 && t < tap.at) ring = { idx: idx, at: tap.at };
      if (t >= tap.at) {
        if (t < end) open = { idx: idx, at: tap.at, word: tap.word.replace(".", ""), pos: g.pos, def: g.def, lit: [idx] };
      }
    });

    (S.glosses || []).forEach(function (g) {
      const gi = WORDS.findIndex(function (w) { return norm(w.t) === g.trigger; });
      if (gi === -1) return;
      const at = WORDS[gi].s + (g.delay == null ? 0.25 : g.delay);
      const until = g.until == null ? S.duration + 1 : g.until;
      if (t >= at && t < until) {
        const lit = [];
        if (g.litRange) {
          for (let k = g.litRange[0]; k <= g.litRange[1]; k++) lit.push(k);
        } else {
          WORDS.forEach(function (w, i) {
            if (g.lit.indexOf(norm(w.t)) !== -1) lit.push(i);
          });
        }
        // La definicion de la BASE manda; la de la escena solo es respaldo.
        const real = STORY && STORY.glossary ? STORY.glossary[g.word.toLowerCase()] : null;
        open = { idx: gi, at: at, word: g.word, pos: (real && real.pos) || g.pos, def: (real && real.def) || g.def, lit: lit };
      }
    });

    tokens.forEach(function (node, i) {
      const kind = WORDS[i].kind;
      const on = i === active;
      const lit = open && open.lit.indexOf(i) !== -1;
      // El dorado del karaoke NO pisa una palabra de vocabulario: en el lector
      // la pastilla del vocabulario gana (lleva !important) y la narracion
      // pasa por encima sin repintarla.
      node.className = "w" +
        (on && !kind ? " wActiveGold" : "") +
        (!kind && open && !lit ? " adDim" : "");
    });
    runs.forEach(function (node) {
      const a = Number(node.getAttribute("data-a"));
      const kind = WORDS[a].kind;
      const lit = open && open.lit.indexOf(a) !== -1;
      node.className = runClass(kind) + (open && !lit ? " adDim" : "");
    });
    const elapsed = REAL ? STORY.offset + time : (time / TL.duration) * STORY.total;
    puncts.forEach(function (node) {
      const i = Number(node.getAttribute("data-i"));
      const lit = open && open.lit.indexOf(i) !== -1;
      node.className = "wp" + (open && !lit ? " adDim" : "");
    });

    const p = Math.min(1, elapsed / STORY.total);
    document.getElementById("fill").style.width = p * 100 + "%";
    document.getElementById("handle").style.left = p * 100 + "%";
    document.getElementById("ts").textContent = fmt(elapsed);

    /* Desplazamiento del cuerpo.
     *
     * En la plantilla normal solo se mueve para dejar la palabra de la
     * tarjeta a la vista. En la plantilla A SANGRE el texto AVANZA SOLO con
     * la narracion, como el lector de verdad: la palabra que suena se queda
     * siempre en la misma linea y el resto sube por detras. Mientras una
     * tarjeta esta abierta el avance se congela en SU palabra, que es de la
     * que habla la tarjeta.
     */
    const focus = open || ring;
    let dy = 0, want = 0;
    if (SCROLLREAD) {
      let ti = open ? open.idx : -1;
      if (ti === -1) {
        for (let i = 0; i < WORDS.length; i++) if (time >= WORDS[i].s) ti = i;
      }
      if (ti < 0) ti = 0;
      // Primera palabra de esa linea: el salto se hace por lineas enteras.
      let first = ti;
      while (first > 0 && geo[first - 1].top === geo[ti].top) first--;
      const to = Math.max(0, geo[ti].top - BODY_TOP - ANCHOR);
      const from = first > 0 ? Math.max(0, geo[first - 1].top - BODY_TOP - ANCHOR) : 0;
      const g = easeOut((time - WORDS[first].s) / 0.3);
      dy = from + (to - from) * g;
      want = to;
    } else if (focus) {
      want = Math.max(0, geo[focus.idx].top - BODY_TOP - 22);
      dy = ring ? want * easeOut((t - (ring.at - 0.5)) / 0.45)
        : want * easeOut((t - open.at) / 0.3);
    }
    const inner = document.getElementById("storyInner");
    if (inner) inner.style.transform = "translateY(" + -dy + "px)";
    if (SCROLLREAD) {
      bodyEl.className = "readerBody" + (dy > 1 ? " adScrolled" : "");
      // El cuerpo se para justo encima del reproductor: si lo cruza, el
      // texto se lee por debajo de los botones.
      bodyEl.style.maxHeight = BAR_TOP - BODY_TOP - 10 + "px";
    }

    if (ring) {
      const g0 = geo[ring.idx];
      el.ring.style.opacity = "1";
      el.ring.style.left = g0.left + g0.w / 2 + "px";
      el.ring.style.top = g0.top - dy + g0.h / 2 + "px";
      const g = easeOut((t - (ring.at - 0.5)) / 0.5);
      el.ring.style.transform = "translate(-50%,-50%) scale(" + (0.55 + g * 0.55) + ")";
    } else {
      el.ring.style.opacity = "0";
    }

    const panel = document.getElementById("panel");
    if (open) {
      const g = easeOut((t - open.at) / 0.28);
      document.getElementById("panelWord").textContent = open.word;
      document.getElementById("panelPos").textContent = open.pos;
      document.getElementById("panelDef").textContent = open.def;
      panel.style.opacity = String(g);
      panel.style.transform = "translateY(" + (1 - g) * 14 + "px)";
      document.getElementById("dimA").className = "readerTitleCentered adDim";
      document.getElementById("dimB").className = "coverWarm adDim";
      // El texto se corta justo debajo de la palabra: ni media linea asomando
      // por el borde de la tarjeta, ni un hueco que no dice nada.
      const focusInside = geo[open.idx].top - want - BODY_TOP;
      if (SCROLLREAD) {
        // Sitio FIJO, justo debajo de la linea donde se ancla la narracion.
        // El texto corre por detras y por debajo, y quien lo corta contra el
        // reproductor es el bloque del desplazamiento, no este.
        panel.style.top = BODY_TOP + ANCHOR + 22 + 12 + "px";
      } else {
        const room = panel.offsetTop - BODY_TOP - 8;
        // Tantas lineas enteras como quepan encima de la tarjeta, contadas
        // desde la palabra: ni media linea asomando ni un hueco vacio.
        const cut = focusInside + 22 * Math.max(1, Math.floor((room - focusInside) / 22));
        bodyEl.style.maxHeight = Math.max(22, Math.min(cut, room)) + "px";
      }
    } else if (taps.length || S.glosses) {
      panel.style.opacity = "0";
      document.getElementById("dimA").className = "readerTitleCentered";
      document.getElementById("dimB").className = "coverWarm";
      /* Con la tarjeta cerrada el texto llega hasta el REPRODUCTOR, no hasta
       * donde ira la tarjeta: cortarlo ahi dejaba media pantalla en blanco
       * mientras la tarjeta no estaba abierta. Al abrirse, el bloque de
       * arriba vuelve a cortar contra ella. */
      if (!SCROLLREAD) {
        const bar = document.querySelector(".audioBar");
        bodyEl.style.maxHeight = S.tour && bar ? bar.offsetTop - BODY_TOP - 10 + "px" : "";
      }
    }
  }

  /* El cursor recorre las cuatro tarjetas y se queda en la correcta. */
  function practice(t) {
    const cards = Array.prototype.slice.call(document.querySelectorAll(".wqCard"));
    const cursor = document.getElementById("wqCursor");
    let stage = "idle", idx = 0;
    if (t >= 6.0) stage = "confirm";
    else if (t >= 5.2) stage = "tap";
    else if (t >= 1.4) stage = "hover";
    if (stage === "hover") {
      const p = Math.min(0.999, (t - 1.4) / 3.8);
      idx = Math.floor(p * 4);
    } else if (stage !== "idle") idx = CORRECT;

    cards.forEach(function (c, i) {
      const hover = stage === "hover" && i === idx;
      const sel = (stage === "tap" || stage === "confirm") && i === CORRECT;
      c.className = "wqCard" + (hover ? " wqCardHover" : "") + (sel ? " wqCardSelected" : "");
    });
    if (stage === "idle" || stage === "confirm") {
      cursor.style.opacity = "0";
    } else {
      cursor.style.opacity = "1";
      cursor.style.left = "calc(" + ((idx % 2) * 50 + 25) + "% - 10px)";
      cursor.style.top = "calc(" + (Math.floor(idx / 2) * 50 + 25) + "% - 10px)";
      cursor.style.transform = stage === "tap" ? "scale(0.85)" : "scale(1)";
    }
    const btn = document.getElementById("wqBtn");
    btn.className = stage === "tap" || stage === "confirm" ? "wqBtnActive" : "wqBtnDisabled";
    btn.textContent = stage === "confirm" ? "CORRECT" : "PICK AN ANSWER";
    document.getElementById("wqTimer").textContent = Math.max(4, 12 - Math.floor(t)) + "s";
    document.getElementById("wqFill").style.width = 12 + (t / S.duration) * 5 + "%";
  }


  /* Practice: cada ejercicio se resuelve solo y el siguiente entra por la
   * derecha. Todo sale del tiempo, sin transiciones CSS: el render pide
   * fotogramas sueltos. */
  function p4(t) {
    const segs = P4.segs;
    let k = 0;
    for (let i = 0; i < segs.length; i++) if (t >= segs[i].start) k = i;
    const seg = segs[k];
    const u = t - seg.start;
    const phoneEl = el.phone;
    const scale = phoneEl.getBoundingClientRect().width / phoneEl.offsetWidth;
    function center(node) {
      const a = node.getBoundingClientRect(), b = phoneEl.getBoundingClientRect();
      return { x: (a.left - b.left + a.width / 2) / scale, y: (a.top - b.top + a.height / 2) / scale };
    }

    document.getElementById("p4Kicker").textContent = seg.kicker;
    document.getElementById("p4Kicker").style.color = seg.color;
    document.getElementById("p4Title").textContent = seg.title;
    document.getElementById("p4Tag").textContent = seg.kicker;

    // Capas: la actual quieta; en los primeros P4.slide s entra desde la derecha
    // y la anterior sale por la izquierda.
    const layers = Array.prototype.slice.call(document.querySelectorAll(".p4Layer"));
    const g = k > 0 ? easeOut(u / P4.slide) : 1;
    layers.forEach(function (ly, i) {
      let x = 120;
      if (i === k) x = (1 - g) * 105;
      else if (i === k - 1 && g < 1) x = -g * 105;
      else if (i < k) x = -120;
      ly.style.transform = "translateX(" + x + "%)";
      ly.style.opacity = Math.abs(x) >= 110 ? "0" : "1";
    });

    let solved = false;
    let ring = null;
    const btn = document.getElementById("p4Btn");

    function choice(gridId, spec, at) {
      const opts = Array.prototype.slice.call(document.querySelectorAll("#" + gridId + " .p4Opt"));
      opts.forEach(function (o) { o.classList.remove("p4OptOk"); });
      if (u >= at - 0.5 && u < at + 0.15) ring = { node: opts[spec.correct], at: at };
      if (u >= at) { opts[spec.correct].classList.add("p4OptOk"); solved = true; }
    }

    if (seg.mode === "meaning") {
      choice("p4g0", P4.meaning, P4.meaning.tap);
    } else if (seg.mode === "context") {
      choice("p4g1", P4.context, P4.context.tap);
      const blank = document.getElementById("p4Blank"), tb = document.getElementById("p4TBlank");
      if (solved) {
        blank.textContent = P4.context.options[P4.context.correct]; blank.className = "p4Blank p4BlankOk";
        tb.textContent = P4.context.answerEn; tb.className = "p4TBlank p4TBlankOk";
      } else {
        blank.textContent = "_____"; blank.className = "p4Blank";
        tb.textContent = "___"; tb.className = "p4TBlank";
      }
    } else if (seg.mode === "listening") {
      const L = P4.listening;
      const play = document.getElementById("p4Play");
      const playing = u >= L.play && u < L.play + 1.6;
      if (u >= L.play - 0.5 && u < L.play + 0.15) ring = { node: play, at: L.play };
      play.className = "p4Play" + (playing ? " p4PlayOn" : "");
      [["p4Wave1", 0], ["p4Wave2", 0.5]].forEach(function (w) {
        const node = document.getElementById(w[0]);
        if (!playing) { node.style.opacity = "0"; return; }
        const ph = ((u - L.play + w[1]) % 1) / 1;
        node.style.opacity = String(0.55 * (1 - ph));
        node.style.transform = "translate(-50%,-50%) scale(" + (1 + ph * 0.7) + ")";
      });
      document.getElementById("p4ListenLabel").textContent = playing ? "TAP TO PAUSE" : "TAP TO LISTEN";
      choice("p4g2", L, L.tap);
    } else {
      const X = P4.match;
      const words = Array.prototype.slice.call(document.querySelectorAll(".p4Word"));
      const means = Array.prototype.slice.call(document.querySelectorAll(".p4Mean"));
      words.concat(means).forEach(function (n) { n.style.borderColor = ""; n.style.background = ""; n.style.color = ""; });
      let done = 0;
      for (let i = 0; i < 4; i++) {
        const tw = X.first + i * X.step, tm = tw + X.gap;
        const col = X.colors[i];
        const paint = function (n) { n.style.borderColor = col; n.style.background = col + "2e"; n.style.color = "#fff"; };
        if (u >= tw) paint(words[i]);
        if (u >= tm) { paint(means[X.answer[i]]); done++; }
        if (u >= tw - 0.45 && u < tw + 0.1) ring = { node: words[i], at: tw };
        if (u >= tm - 0.38 && u < tm + 0.1) ring = { node: means[X.answer[i]], at: tm };
      }
      solved = done === 4;
    }

    btn.className = solved ? "wqBtnActive" : "wqBtnDisabled";
    btn.textContent = solved ? "CORRECT ✓" : seg.mode === "match" ? "MATCH THE PAIRS" : "PICK AN ANSWER";

    // Una sesion ya empezada: los ejercicios anteriores cuentan como hechos.
    const doneSteps = (S.practiceStep ? S.practiceStep - 1 : 0) + k + (solved ? 1 : 0);
    Array.prototype.slice.call(document.querySelectorAll(".wqStep")).forEach(function (s, i) {
      s.className = "wqStep" + (i < doneSteps ? " wqStepDone" : "");
    });
    document.getElementById("p4Xp").textContent = "+" + doneSteps * 6;
    document.getElementById("p4Timer").textContent = Math.max(1, seg.timer - Math.floor(u)) + "s";
    document.getElementById("p4Fill").style.width = Math.min(100, (doneSteps / 8) * 100 + 4) + "%";

    if (ring) {
      const c = center(ring.node);
      const r = easeOut((u - (ring.at - 0.5)) / 0.5);
      el.ring.style.opacity = String(u > ring.at ? Math.max(0, 1 - (u - ring.at) / 0.15) : 1);
      el.ring.style.left = c.x + "px";
      el.ring.style.top = c.y + "px";
      el.ring.style.transform = "translate(-50%,-50%) scale(" + (0.55 + r * 0.55) + ")";
    } else {
      el.ring.style.opacity = "0";
    }
  }

  let comboClip = false;
  function combo(t) {
    const sw = S.switchAt;
    // Con el telefono entero la historia no cabe: el texto se corta en una
    // fundido justo encima del reproductor, en vez de meterse debajo.
    if (!comboClip) {
      comboClip = true;
      const bar = document.querySelector("#comboA .audioBar");
      const body = document.getElementById("storyBody");
      const room = bar.offsetTop - body.offsetTop - 10;
      const st = document.createElement("style");
      st.textContent = "#comboA .readerBody{max-height:" + room + "px;overflow:hidden;" +
        "-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 30px),transparent)}";
      document.head.appendChild(st);
    }
    const g = t < sw ? 0 : easeOut((t - sw) / 0.4);
    document.getElementById("comboA").style.transform = "translateX(" + -g * 105 + "%)";
    document.getElementById("comboB").style.transform = "translateX(" + (1 - g) * 105 + "%)";
    // Practice primero: los dos manejan el anillo del toque, y en la historia
    // manda el lector.
    if (S.hook2) {
      const h = Math.min(1, Math.max(0, (t - (sw - 0.15)) / 0.35));
      const a = document.getElementById("hookA"), b = document.getElementById("hookB");
      a.style.opacity = String(1 - h);
      a.style.transform = "translateY(" + -h * 10 + "px)";
      b.style.opacity = String(h);
      b.style.transform = "translateY(" + (1 - h) * 10 + "px)";
    }
    p4(Math.max(t, sw));
    if (t < sw + 0.4) reader(Math.min(t, sw));
    if (t >= sw) el.ring.style.opacity = t >= sw + S.tap - 0.5 && t < sw + S.tap + 0.15 ? el.ring.style.opacity : "0";
  }

  function catalog(t) {
    const grid = document.getElementById("catGrid");
    const total = grid.scrollHeight - document.querySelector(".adGridWrap").clientHeight;
    const p = easeOut(Math.min(1, t / (S.duration - 0.6)));
    grid.style.transform = "translateY(" + -Math.max(0, total) * p + "px)";
  }

  /** Karaoke y tarjeta sin telefono: misma logica, otra caja. */
  function bare(t) {
    const time = Math.min(t, TL.duration);
    let active = -1;
    for (let i = 0; i < WORDS.length; i++) {
      if (time >= WORDS[i].s && time < WORDS[i].e) { active = i; break; }
    }
    let open = null;
    (S.glosses || []).forEach(function (g) {
      const gi = WORDS.findIndex(function (w) { return norm(w.t) === g.trigger; });
      if (gi === -1) return;
      const at = WORDS[gi].s + (g.delay == null ? 0.25 : g.delay);
      const until = g.until == null ? S.duration + 1 : g.until;
      if (t >= at && t < until) {
        const lit = [];
        WORDS.forEach(function (w, i) {
          if (g.lit.indexOf(norm(w.t)) !== -1) lit.push(i);
        });
        open = { at: at, word: g.word, pos: g.pos, def: g.def, lit: lit };
      }
    });

    bareTokens.forEach(function (node, i) {
      const kind = WORDS[i].kind;
      const on = i === active;
      const lit = open && open.lit.indexOf(i) !== -1;
      node.className = "bw" +
        (on ? " bwGold" : kind === "sky" ? " bwSky" : kind === "green" ? " bwGreen" : "") +
        (open && !lit ? " bwDim" : "");
    });

    const elapsed = REAL ? STORY.offset + time : time;
    document.getElementById("bBarFill").style.width =
      Math.min(100, (elapsed / STORY.total) * 100) + "%";

    const card = document.getElementById("bCard");
    if (open) {
      const g = easeOut((t - open.at) / 0.3);
      document.getElementById("bCardWord").textContent = open.word;
      document.getElementById("bCardPos").textContent = open.pos;
      document.getElementById("bCardDef").textContent = open.def;
      card.style.opacity = String(g);
      card.style.transform = "translateY(" + (1 - g) * 16 + "px)";
    } else {
      card.style.opacity = "0";
      card.style.transform = "translateY(16px)";
    }
  }

  function seek(t) {
    if (!S.noEntrance) entrance(t);
    if (S.layout) bare(t);
    else if (S.screen === "reader") reader(t);
    else if (S.screen === "practice") practice(t);
    else if (S.screen === "practice4") p4(t);
    else if (S.screen === "combo") combo(t);
    else catalog(t);
  }

  /* Sonidos de la app en cada acierto, con la regla de la app: el primero es
   * el de acierto y desde el segundo seguido suena el de racha EN SU LUGAR
   * (MobileLibraryShell, playPracticeFeedbackSound). Los tiempos salen de los
   * mismos datos que pintan la escena. */
  const hits = [];
  if (S.screen === "practice4") {
    P4.segs.forEach(function (sg) {
      if (sg.mode === "match") {
        const X = P4.match;
        hits.push(sg.start + X.first + 3 * X.step + X.gap);
      } else hits.push(sg.start + P4[sg.mode].tap);
    });
  } else if (S.screen === "combo") hits.push(S.switchAt + S.tap);
  // Con practiceStep, los aciertos anteriores de la sesion ya cuentan para la racha.
  const before = S.practiceStep ? S.practiceStep - 1 : 0;
  const sfx = hits.map(function (at, i) {
    return { file: before + i === 0 ? "practice-correct.mp3" : "practice-combo.mp3", at: at };
  });
  /* Tictac mientras el ejercicio esta en pantalla sin resolver: marca que hay
   * un reloj corriendo. El prefijo "ad:" sale de scripts/_ads/sfx, no de los
   * sonidos que se envian con la app. */
  if (S.clock && S.screen === "combo") sfx.unshift({ file: "ad:clock-5000.mp3", at: S.switchAt });
  /* Una expresion larga no cabe a 30 px junto al altavoz: se encoge hasta caber. */
  const p4w = document.querySelector("#comboB .p4Word3") || document.querySelector(".p4Word3");
  if (p4w) {
    const row = p4w.parentElement;
    let fs = 30;
    while (row.scrollWidth > row.clientWidth && fs > 18) { fs -= 1; p4w.style.fontSize = fs + "px"; }
  }
  window.__ad = { seek: seek, duration: S.duration, speed: S.speed || 1, width: GEO.w, height: GEO.h, audioUntil: S.audioUntil || null, audioFade: S.audioFade || 0.6, sfx: sfx };
  seek(0);
})();
