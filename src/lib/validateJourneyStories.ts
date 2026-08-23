/**
 * Validador de JOURNEY: lo que solo se ve mirando las 21 juntas.
 *
 * POR QUE EXISTE (2026-08-23). `validateGeneratedStory` juzga una historia
 * suelta, y por eso pasaron en verde tres reglas que son de conjunto: los siete
 * personajes del Traveler DE A0 entraban sin decir QUE SON (tres de ellos con
 * su presentacion despues de su primera linea citada), 14 de 21 historias
 * abrian con la misma forma, y `Die zwei` sustituyo a los nombres en 13. Nada
 * de eso es visible por historia; todo es visible por journey.
 *
 * DOS DECISIONES:
 *
 * 1. **Un check que no sabe medir FALLA, no pasa.** Cada regla declara los
 *    idiomas que su detector reconoce de verdad. Si el journey esta en un
 *    idioma que la regla no cubre, devuelve `not-implemented`, que bloquea
 *    igual que un fallo. Es el agujero que ya habia costado dos veces:
 *    `narrator-intro-block-shared` busca `um/uma` y `body-cefr-a0-grammar`
 *    solo conoce el espanol, asi que sobre un cuerpo aleman salian verdes sin
 *    medir nada y parecian cobertura.
 *
 * 2. **La lista de reglas vive en `docs/story-rules.json`, no aqui.** El gate
 *    lee el inventario y falla si una regla declarada con `gate: "journey"` no
 *    tiene implementacion. Enumerar deja de depender de que alguien se acuerde.
 */
import rulesDoc from "../../docs/story-rules.json";
import { renderedParagraphs } from "@/lib/readerParagraphs";

export type JourneyStoryInput = {
  slug: string;
  title: string;
  text: string;
  language: string;
  level: string;
  vocab?: Array<{ word: string; surface?: string | null }> | null;
};

export type JourneyCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "not-implemented";
  detail?: string;
};

const QUOTE_OPEN = "“";
const QUOTE_CLOSE = "”";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s: string) =>
  s.replace(/\s*\n+\s*/g, " ").split(/(?<=[.!?”])\s+/).map((f) => f.trim()).filter(Boolean);

/** Palabras dentro de comillas curvas sobre el total del cuerpo. */
function quotedPct(text: string): number {
  const re = new RegExp(`${QUOTE_OPEN}([^${QUOTE_CLOSE}]*)${QUOTE_CLOSE}`, "g");
  let inside = 0;
  for (const m of text.matchAll(re)) inside += words(m[1]);
  const total = words(text);
  return total ? (inside / total) * 100 : 0;
}

/**
 * El REPARTO, no los sustantivos propios.
 *
 * El primer intento fue "mayuscula y nunca con articulo delante", el criterio
 * de la ficha de journeys. En aleman eso mete `Leipzig`, `Jahren`, `Minuten` y
 * `Mutter` en el reparto, porque despues de una preposicion sin articulo
 * cualquier sustantivo cumple. Lo que separa a una PERSONA de un sitio o de un
 * sustantivo comun en estos textos es que la persona HABLA: sale pegada a un
 * verbo de habla, en cualquiera de los dos ordenes. Y se pide en dos historias
 * o mas para no meter a un figurante de una escena.
 */
const HABLA_POR_IDIOMA: Record<string, string> = {
  DE: "sagt|fragt|antwortet|ruft|nickt|lacht|schweigt|schreibt|erzählt|flüstert|zählt",
  // Portugues: presente Y preterito, porque desde el 2026-08-19 la ultima
  // historia de cada tema se narra en pasado y con solo el presente el reparto
  // salia vacio (`protagonista ?`).
  PT: "diz|disse|pergunta|perguntou|responde|respondeu|avisa|avisou|repete|repetiu|conta|contou|explica|explicou|grita|gritou|chama|chamou|pede|pediu|ri|riu|ensina|ensinou|escreve|escreveu",
};
function castOf(stories: JourneyStoryInput[], lang: string): string[] {
  const HABLA = HABLA_POR_IDIOMA[lang] ?? HABLA_POR_IDIOMA.DE;
  const cuentaHabla = new Map<string, Set<string>>();
  for (const s of stories) {
    for (const re of [
      new RegExp(`(?:${HABLA})\\s+([\\p{Lu}][\\p{Ll}]+)`, "gu"),
      new RegExp(`([\\p{Lu}][\\p{Ll}]+)\\s+(?:${HABLA})`, "gu"),
    ]) {
      for (const m of s.text.matchAll(re)) {
        if (!cuentaHabla.has(m[1])) cuentaHabla.set(m[1], new Set());
        cuentaHabla.get(m[1])!.add(s.slug);
      }
    }
  }
  const hablan = new Set([...cuentaHabla].filter(([, v]) => v.size >= 2).map(([k]) => k));
  return castLegacy(stories).filter((n) => hablan.has(n));
}
function castLegacy(stories: JourneyStoryInput[]): string[] {
  const ART = /\b(der|die|das|den|dem|des|ein|eine|einen|einem|einer|zum|zur|im|am|beim|vom|le|la|les|un|une|du|el|los|las|il|lo|gli|o|a|os|as|um|uma)\s+$/i;
  // OJO: aqui van ARTICULOS, no preposiciones. Meter "de", "da", "no"... echa
  // del reparto a cualquiera que aparezca en "a mao de Rafaela" o "a filha da
  // Neide", que es media historia: el 2026-08-23 el reparto salio VACIO y el
  // check de cierres degeneró a "todas las historias terminan a solas".
  const MID = /[\p{Ll}],?\s+$/u;
  const conArticulo = new Set<string>();
  const cuenta = new Map<string, number>();
  for (const s of stories) {
    const vistos = new Set<string>();
    for (const m of s.text.matchAll(/\p{Lu}\p{Ll}{2,}/gu)) {
      const i = m.index ?? 0;
      const antes = s.text.slice(Math.max(0, i - 14), i);
      if (ART.test(antes)) { conArticulo.add(m[0]); continue; }
      if (MID.test(antes)) vistos.add(m[0]);
    }
    for (const w of vistos) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .filter(([w, n]) => n >= 2 && !conArticulo.has(w))
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);
}

/** Las tres formas de presentacion aprobadas, en aleman. */
const DET_DE = "(?:der|die|das|den|ein|eine|einen|einer|ihr|ihre|ihren|sein|seine|seinen)";
const NUC_DE = "(?:[a-zäöüß]+\\s+){0,2}[A-ZÄÖÜ][a-zäöüß]+";
const FORMAS_DE: Array<[string, (n: string) => RegExp]> = [
  ["aposicion", (n) => new RegExp(`${n},\\s+${DET_DE}\\s+${NUC_DE}`, "u")],
  ["titulo y nombre", (n) => new RegExp(`(?:(?:Ihre?|Seine?)\\w*|[A-ZÄÖÜ][a-zäöüß]+s)\\s+\\w+\\s+${n}\\b`, "u")],
  ["con sein", (n) => new RegExp(`\\b${n}\\s+ist\\s+(?:${DET_DE}\\s+)?${NUC_DE}`, "u")],
];

/**
 * Las tres formas aprobadas en PORTUGUES, fijadas con el usuario el 2026-08-18
 * mientras se escribia el Traveler PT-BR A1 ([[feedback_introduce_characters]]):
 *
 *   aposicion   Rafaela, uma moca de Sao Paulo, chega em Manaus...
 *   quem        Quem serve e Dora, uma senhora de Belem que abre a banca...
 *   nombre      Neide vende na mesma calcada desde que a filha dela nasceu.
 *
 * La tercera pide un verbo que DIGA QUE ES la persona (oficio, papel o cuanto
 * lleva ahi); "Rafaela chega" no presenta a nadie y por eso no entra.
 */
const NUC_PT = "(?:[a-zà-ú]+\\s+){0,3}[a-zà-ú]+";
const VERBO_SER_PT = "(?:é|foi|era|trabalha|trabalhou|vende|vendia|leva|levava|cuida|cuidava|pinta|pintava|desceu|mora|morava|abre|abria|serve|servia|senta|sentava|nasceu|estuda|estudava|pesca|pescava|sobe|subia)";
const FORMAS_PT: Array<[string, (n: string) => RegExp]> = [
  ["aposicion", (n) => new RegExp(`${n},\\s+(?:um|uma)\\s+${NUC_PT}`, "iu")],
  ["quem", (n) => new RegExp(`\\bQuem\\s+[a-zà-ú]+(?:\\s+[a-zà-ú]+)?\\s+é\\s+${n}\\b`, "iu")],
  ["nombre y oficio", (n) => new RegExp(`\\b${n}\\s+(?:${VERBO_SER_PT})\\b`, "iu")],
];

/**
 * Las tres formas aprobadas en FRANCES, fijadas escribiendo el Expat FR A0 de
 * Lyon (2026-08-23). Mismo contrato que el portugues: la forma tiene que decir
 * QUE ES la persona, no que hace.
 *
 *   aposicion   Sylvie, une voisine du troisieme, monte avec un sac.
 *   s'appeler   La professeure s'appelle Lea et parle lentement.
 *   con etre    Manon est une jeune femme de Clermont-Ferrand.
 */
const NUC_FR = "(?:[a-zà-ÿ']+\\s+){0,3}[a-zà-ÿ']+";
const FORMAS_FR: Array<[string, (n: string) => RegExp]> = [
  ["aposicion", (n) => new RegExp(`${n},\\s+(?:un|une|le|la|l')\\s*${NUC_FR}`, "iu")],
  ["s'appeler", (n) => new RegExp(`s'appelle\\s+${n}\\b`, "iu")],
  ["con etre", (n) => new RegExp(`\\b${n}\\s+est\\s+(?:un|une)\\s+${NUC_FR}`, "iu")],
];

const FORMAS_POR_IDIOMA: Record<string, Array<[string, (n: string) => RegExp]>> = {
  DE: FORMAS_DE,
  PT: FORMAS_PT,
  FR: FORMAS_FR,
};

/** Forma de la apertura: que clase de sujeto abre la primera frase. */
function openingShapePT(text: string): string {
  const f = sentences(text)[0] ?? "";
  const w = (f.split(/\s+/)[0] ?? "").replace(/[.,:;]$/, "");
  if (f.startsWith(QUOTE_OPEN)) return "replica directa";
  if (/^(O|A|Os|As)$/.test(w)) return "articulo definido + sustantivo";
  if (/^(Um|Uma|Uns|Umas)$/.test(w)) return "articulo indefinido + sustantivo";
  if (/^(No|Na|Nos|Nas|Do|Da|Dos|Das|Ao|À|Em|Entre|Dentro|Atrás|Depois|Antes|Sobre|Debaixo)$/.test(w)) return "lugar o tiempo delante";
  if (/^(Às|Aos|Quinze|Dois|Duas|Três|Quatro|Cinco|Seis|Sete|Oito|Dez|Vinte|Trinta|Meia|Cada|Todo|Toda)$/.test(w)) return "hora o cantidad";
  if (/^Quem\b/.test(f)) return "quem + verbo";
  if (/^\p{Lu}\p{Ll}+$/u.test(w)) return "sustantivo o nombre desnudo";
  return "otra";
}

function openingShapeFR(text: string): string {
  const f = sentences(text)[0] ?? "";
  const w = (f.split(/\s+/)[0] ?? "").replace(/[.,:;]$/, "");
  if (f.startsWith(QUOTE_OPEN)) return "replica directa";
  if (/^(Le|La|Les|L')/.test(w)) return "articulo definido + sustantivo";
  if (/^(Un|Une|Des)$/.test(w)) return "articulo indefinido + sustantivo";
  if (/^(Son|Sa|Ses|Leur|Leurs|Mon|Ma)$/.test(w)) return "posesivo + sustantivo";
  if (/^(À|Au|Aux|Dans|Sur|Sous|Devant|Derrière|Chez|En|Entre|Après|Avant|Depuis|Vers|Pendant|Fin|Ici)$/.test(w)) return "lugar o tiempo delante";
  if (/^(Il|Elle|Ils|Elles|On|Personne|Quelqu'un|Tout|Toute|Tous)$/.test(w)) return "pronombre";
  if (/^(Deux|Trois|Quatre|Cinq|Six|Sept|Huit|Neuf|Dix|Vingt|Trente|Chaque|Une fois)$/.test(w)) return "hora o cantidad";
  if (/^\p{Lu}\p{Ll}+$/u.test(w)) return "sustantivo o nombre desnudo";
  return "otra";
}

function openingShape(text: string): string {
  const f = sentences(text)[0] ?? "";
  const w = f.split(/\s+/)[0] ?? "";
  if (/^(Der|Die|Das)$/.test(w)) return "articulo definido + sustantivo";
  if (/^(Ein|Eine|Einen)$/.test(w)) return "articulo indefinido + sustantivo";
  if (/^(Ihr|Ihre|Sein|Seine)/.test(w)) return "posesivo + sustantivo";
  if (/^(Viel|Viele|Wenig|Zwei|Drei|Vier|Sieben|Alle|Niemand|Jemand)$/.test(w)) return "cantidad o pronombre";
  if (/^\p{Lu}\p{Ll}+$/u.test(w)) return /^(?:[A-ZÄÖÜ][a-zäöüß]+)$/.test(w) && /^\p{Lu}\p{Ll}+\s+\p{Ll}/u.test(f)
    ? "sustantivo o nombre desnudo" : "sustantivo o nombre desnudo";
  return "otra";
}

/** Suelo A0 aleman: sujeto primero, sin separables partidos, solo presente. */
const A0_DE_NO_SUJETO = new RegExp(
  "^(In|Im|An|Am|Auf|Aus|Bei|Beim|Mit|Nach|Seit|Von|Vom|Vor|Zu|Zum|Zur|Über|Unter|Zwischen|Durch|Für|Gegen|Ohne|Um|Neben|Hinter|" +
  "Dann|Danach|Heute|Gestern|Später|Manchmal|Plötzlich|Oben|Unten|Draußen|Drinnen|Hier|Dort|Jetzt|Deshalb|Trotzdem|Endlich|" +
  "Sofort|Zuerst|Abends|Morgens|Nachts|Einmal|Zweimal|Diesmal|Damals|Wieder|Nur|Auch|Noch|Immer|Halb|Weiß|Grau|Kalt|Warm|Hoch|Tief|Lang|Kurz|Voll|Leise|Laut|Steil)\\b"
);
const A0_DE_SUJETO_OK = /^(?:Halb|Weiß|Grau|Kalt|Warm|Hoch|Tief|Lang|Kurz|Voll|Leise|Laut|Steil|Zwei|Drei|Vier|Sieben)\s+(?:[a-zäöüß]+\s+)?[A-ZÄÖÜ]/;
const A0_DE_PARTICULAS = ["an","auf","aus","ein","mit","nach","vor","zu","ab","bei","hin","her","zurück","los","weiter","vorbei","herum","raus","rein","weg","nieder"];
const A0_DE_PASADO = /\b(war|waren|hatte|hatten|ging|kam|sagte|machte|stand|sah|nahm|gab|fuhr|wurde|wurden)\b/;

export function validateJourneyStories(
  stories: JourneyStoryInput[],
  ctx: {
    language: string;
    level: string;
    /** Nombres de personas REALES (solicitantes de la beta). Los pasa
     *  saveStory.ts desde la base; sin ellos el check no puede medir. */
    realPeople?: string[];
  }
): JourneyCheck[] {
  const out: JourneyCheck[] = [];
  // La app llama al idioma por su nombre ("portuguese") y el CLI por su codigo
  // ("PT"). El checker medía solo lo segundo, asi que un journey cargado desde
  // la base caia en "sin gate" por el formato, no por el idioma.
  const NOMBRE_A_CODIGO: Record<string, string> = {
    GERMAN: "DE", SPANISH: "ES", PORTUGUESE: "PT", ITALIAN: "IT", FRENCH: "FR", ENGLISH: "EN",
  };
  const langRaw = (ctx.language || "").toUpperCase();
  const lang = NOMBRE_A_CODIGO[langRaw] ?? langRaw;
  const level = (ctx.level || "").toUpperCase();
  const narradas = stories.filter((s) => s.text.includes(QUOTE_OPEN));

  const push = (id: string, label: string, ok: boolean, detail?: string) =>
    out.push({ id, label, status: ok ? "pass" : "fail", detail: ok ? undefined : detail });
  const noImpl = (id: string, label: string, why: string) =>
    out.push({ id, label, status: "not-implemented", detail: why });

  // ── 1. Banda de habla citada ────────────────────────────────
  {
    const fuera = narradas
      .map((s) => ({ slug: s.slug, pct: quotedPct(s.text) }))
      .filter((x) => x.pct < 25 || x.pct > 35);
    push("journey-quoted-speech-band", "Habla citada 25-35% en todas", fuera.length === 0,
      `${fuera.length}/${narradas.length} fuera: ${fuera.map((x) => `${x.slug} ${x.pct.toFixed(0)}%`).join(", ")}`);
  }

  const cast = castOf(stories, lang);

  // ── 2 y 3. Presentacion de personajes y variedad de forma ───
  const FORMAS = FORMAS_POR_IDIOMA[lang];
  if (!FORMAS) {
    const why = `El detector de presentacion no esta escrito para ${lang || "?"}. ` +
      `Un check que no sabe medir NO puede pasar: implementa las tres formas para ${lang} en FORMAS_POR_IDIOMA.`;
    noImpl("journey-character-introduction", "Cada personaje presentado antes de su primera cita", why);
    noImpl("journey-introduction-form-variety", "Las tres formas de presentacion se alternan", why);
  } else {
    const formas: string[] = [];
    const malos: string[] = [];
    for (const n of cast) {
      const primera = stories.find((s) => new RegExp(`\\b${n}\\b`, "u").test(s.text));
      if (!primera) continue;
      const t = primera.text;
      const forma = FORMAS.find(([, re]) => re(n).test(t));
      const posCita = t.indexOf(QUOTE_OPEN);
      const posPres = forma ? t.search(forma[1](n)) : -1;
      if (!forma) { malos.push(`${n} (${primera.slug}): sin sintagma que diga que es`); continue; }
      if (posCita >= 0 && posPres > posCita) { malos.push(`${n} (${primera.slug}): presentado despues de su primera cita`); continue; }
      formas.push(forma[0]);
    }
    push("journey-character-introduction", "Cada personaje presentado antes de su primera cita",
      malos.length === 0, malos.join("; "));
    const porForma = new Map<string, number>();
    for (const f of formas) porForma.set(f, (porForma.get(f) ?? 0) + 1);
    const peor = Math.max(0, ...porForma.values());
    push("journey-introduction-form-variety", "Las tres formas de presentacion se alternan",
      formas.length < 3 || peor <= Math.ceil(formas.length / 2),
      `${peor} de ${formas.length} usan la misma forma: ${[...porForma].map(([k, v]) => `${k} x${v}`).join(", ")}`);
  }

  // ── 4. Forma de la apertura ─────────────────────────────────
  {
    const porForma = new Map<string, string[]>();
    for (const s of stories) {
      const f = lang === "PT" ? openingShapePT(s.text)
        : lang === "FR" ? openingShapeFR(s.text)
        : openingShape(s.text);
      porForma.set(f, [...(porForma.get(f) ?? []), s.slug]);
    }
    const tope = Math.max(2, Math.ceil(stories.length / 3));
    const pasadas = [...porForma].filter(([, v]) => v.length > tope);
    push("journey-opening-shape", `Ninguna forma de apertura en mas de ${tope} historias`,
      pasadas.length === 0,
      pasadas.map(([k, v]) => `${k}: ${v.length} (${v.slice(0, 4).join(", ")}...)`).join(" · "));
  }

  // ── 5. Cierres a solas ──────────────────────────────────────
  {
    const hero = cast[0] ?? "";
    const solos = stories.filter((s) => {
      const ultimo = s.text.trim().split(/\n{2,}/).pop() ?? "";
      if (ultimo.includes(QUOTE_OPEN)) return false;
      return !cast.slice(1).some((n) => ultimo.includes(n));
    });
    push("journey-closing-alone", "Como mucho la mitad de los cierres con el protagonista a solas",
      solos.length <= Math.ceil(stories.length / 2),
      `${solos.length}/${stories.length} (protagonista ${hero || "?"}): ${solos.map((s) => s.slug).join(", ")}`);
  }

  // ── 6. Formulas repetidas al empezar frase ──────────────────
  {
    const cuenta = new Map<string, Set<string>>();
    for (const s of stories) {
      // Solo narracion: dentro de comillas, "Das ist" no es una muletilla del
      // narrador sino habla normal, y salia marcado en 8 historias.
      const narr = s.text.replace(new RegExp(`${QUOTE_OPEN}[^${QUOTE_CLOSE}]*${QUOTE_CLOSE}`, "g"), " ");
      for (const f of sentences(narr)) {
        const limpio = f.trim();
        const w = limpio.split(/\s+/);
        if (w.length < 3) continue;
        for (const n of [2, 3]) {
          const g = w.slice(0, n).join(" ").replace(/[.,;:!?]$/, "");
          if (!/^\p{Lu}/u.test(g)) continue;
          if (cast.some((c) => g.includes(c))) continue;
          if (!cuenta.has(g)) cuenta.set(g, new Set());
          cuenta.get(g)!.add(s.slug);
        }
      }
    }
    const tope = Math.max(3, Math.ceil(stories.length / 5));
    const tics = [...cuenta].filter(([, v]) => v.size > tope).sort((a, b) => b[1].size - a[1].size);
    push("journey-repeated-opener", `Ninguna formula abre frase en mas de ${tope} historias`,
      tics.length === 0,
      tics.slice(0, 6).map(([k, v]) => `"${k}" en ${v.size}`).join(" · "));
  }

  // ── 7. Suelo A0 ─────────────────────────────────────────────
  if (level === "A0") {
    if (lang === "FR") {
      // Suelo A0 frances (2026-08-23): la NARRACION va en presente. El passe
      // compose y el imparfait se permiten DENTRO de comillas, que es habla
      // real y el alumno la oye igual en la calle.
      // Dos trampas del frances que un detector ingenuo se come:
      //   - "sait", "fait", "plait" son PRESENTE y acaban en -ait como el
      //     imperfecto, asi que van a la lista de excepciones;
      //   - "est fermee", "est trempee" son adjetivo, no passe compose, asi
      //     que el participio se pide de una lista blanca de verbos de accion.
      // Adverbios y sustantivos que acaban como un imperfecto sin serlo.
      const PRESENTE_EN_AIT = /^(?:sait|fait|plaît|plait|connaît|connait|paraît|parait|naît|nait|vaut|faut|jamais|mais|frais|vrais|désormais|français|palais|relais|balais)$/;
      const PARTICIPIOS = "(?:allé|allée|venu|venue|arrivé|arrivée|resté|restée|sorti|sortie|monté|montée|descendu|descendue|parti|partie|entré|entrée|pris|prise|mis|mise|dit|dite|vu|vue|fait|faite|écrit|écrite|répondu|compris|comprise|proposé|proposée|réparé|réparée|acheté|achetée|donné|donnée|trouvé|trouvée|perdu|perdue|oublié|oubliée|appelé|appelée|changé|changée|décidé|décidée|signé|signée)";
      const AUX = "(?:ai|as|a|avons|avez|ont|suis|es|est|sommes|êtes|sont)";
      // `\b` de JavaScript es ASCII: en "Léa" ve un limite antes de la "a"
      // final y "Léa écrit" pasaba por "a + ecrit", un passe compose que no
      // existe. Los limites se hacen con lookarounds Unicode.
      const L = "(?<![\\p{L}])";
      const R = "(?![\\p{L}])";
      const PC_FR = new RegExp(`${L}${AUX}\\s+${PARTICIPIOS}${R}`, "iu");
      const IMP_FR = new RegExp(`${L}(\\p{Ll}{3,}(?:ais|ait|ions|iez|aient))${R}`, "u");
      const malas: string[] = [];
      for (const s of stories) {
        const narr = s.text.replace(new RegExp(`${QUOTE_OPEN}[^${QUOTE_CLOSE}]*${QUOTE_CLOSE}`, "g"), " ");
        for (const f of sentences(narr)) {
          if (f.length < 4) continue;
          const imp = f.match(IMP_FR);
          const impReal = imp ? !PRESENTE_EN_AIT.test(imp[1].toLowerCase()) : false;
          if (PC_FR.test(f) || impReal) malas.push(`${s.slug}: [no es presente] ${f.slice(0, 70)}`);
        }
      }
      push("journey-a0-floor", "Suelo A0: la narracion va en presente",
        malas.length === 0, malas.slice(0, 8).join(" | "));
    } else if (lang !== "DE") {
      noImpl("journey-a0-floor", "Suelo A0: sujeto primero, sin separables partidos, solo presente",
        `El suelo A0 solo esta implementado para DE; este journey es ${lang || "?"}. Escribelo antes de guardar.`);
    } else {
      const partFinal = new RegExp(`\\s(${A0_DE_PARTICULAS.join("|")})\\s*[.!?]$`);
      const malas: string[] = [];
      for (const s of stories) {
        const narr = s.text.replace(new RegExp(`${QUOTE_OPEN}[^${QUOTE_CLOSE}]*${QUOTE_CLOSE}`, "g"), " ");
        for (const f of sentences(narr)) {
          if (f.length < 4) continue;
          const flags: string[] = [];
          if (A0_DE_NO_SUJETO.test(f) && !A0_DE_SUJETO_OK.test(f)) flags.push("no empieza por el sujeto");
          if (partFinal.test(f)) flags.push("particula separable al final");
          if (/\bes gibt\b/i.test(f)) flags.push("es gibt");
          if (A0_DE_PASADO.test(f)) flags.push("no es presente");
          if (flags.length) malas.push(`${s.slug}: [${flags.join(" · ")}] ${f.slice(0, 60)}`);
        }
      }
      push("journey-a0-floor", "Suelo A0: sujeto primero, sin separables partidos, solo presente",
        malas.length === 0, malas.slice(0, 8).join(" | "));
    }
  }

  // ── 8. Ni ancianos ni ninos ────────────────────────────────
  {
    const EDAD = /\b(Kind|Kinder|Junge|Jungen|Mädchen|Baby|Enkel\w*|Oma|Opa|Großmutter|Großvater|Rentner\w*|Greis\w*|Teenager)\b/g;
    const halladas = new Set<string>();
    for (const s of stories) for (const m of s.text.matchAll(EDAD)) halladas.add(m[0]);
    push("journey-no-elderly-no-children", "Ni ancianos ni ninos en contenido nuevo",
      halladas.size === 0, [...halladas].join(", "));
  }

  // ── 9. Sin comentarios sobre el acento ─────────────────────
  {
    const AC = /\b(Akzent|Dialekt|Mundart|acento|sotaque|accent)\b/gi;
    const halladas = new Set<string>();
    for (const s of stories) for (const m of s.text.matchAll(AC)) halladas.add(m[0]);
    push("journey-no-accent-mentions", "Las historias no comentan el acento de nadie",
      halladas.size === 0, [...halladas].join(", "));
  }

  // ── 10. Ninguna persona real como personaje ────────────────
  if (!ctx.realPeople) {
    noImpl("journey-no-real-users", "Ningun personaje coincide con una persona real",
      "No se paso la lista de solicitantes; sin ella el check no puede medir. Lo llena saveStory.ts desde la base.");
  } else {
    const choque = cast.filter((n) =>
      ctx.realPeople!.some((r) => r.split(/\s+/).some((parte) => parte === n)));
    push("journey-no-real-users", "Ningun personaje coincide con una persona real",
      choque.length === 0, `Coinciden con un solicitante: ${choque.join(", ")}`);
  }

  // ── 11. Nombres en la ortografia del idioma ────────────────
  {
    // Cada idioma tiene sus diacriticos; un nombre con los de OTRO idioma es
    // el error que caza esta regla (una `ñ` en aleman, una `ö` en espanol).
    const AJENOS: Record<string, RegExp> = {
      DE: /[áéíóúñçàèìòùâêîôûãõ]/i,
      ES: /[äöüßçàèìòùâêîôûãõ]/i,
      IT: /[äöüßñç]/i,
      FR: /[äöüßñãõ]/i,
      PT: /[äöüßñ]/i,
    };
    const re = AJENOS[lang];
    if (!re) {
      noImpl("journey-names-target-language", "Nombres en la ortografia del idioma",
        `Sin lista de diacriticos ajenos para ${lang || "?"}.`);
    } else {
      const raros = cast.filter((n) => re.test(n));
      push("journey-names-target-language", "Nombres en la ortografia del idioma",
        raros.length === 0, raros.join(", "));
    }
  }

  // ── 12. Escalera de recirculacion ──────────────────────────
  //
  // Una plaza que sale una sola vez en todo el journey se enseña y no se vuelve
  // a ver. El escenario ideal son cuatro encuentros por palabra
  // ([[project_vocab_recirculation_ladder]]), con 12 portables y 8 ancladas al
  // sitio por historia.
  //
  // EL UMBRAL NO ESTA INVENTADO: es el listón que ya tienen los buenos, medido
  // sobre el catalogo el 2026-08-23. En A0 los journeys publicados dan 4,25
  // (Traveler ES LATAM), 3,17 (Friends ES Spain) y 3,12 (Traveler ES Mexico);
  // el suelo se pone en 3,0, por debajo de los tres. En C1 el catalogo entero
  // vive entre 0,8 y 1,5, asi que ahi NO se mide: poner un numero seria
  // inventarselo, y bajarlo hasta que pase seria calibrar el gate hacia abajo.
  // A1 recalibrado el 2026-08-23 sobre A1 REALES, que es lo que faltaba: el
  // 2,5 de la primera version no salio de ningun A1, se extrapolo del A0. Los
  // tres A1 del catalogo dan 1,88 (Traveler DE, draft), 1,63 (Traveler ES, el
  // unico PUBLICADO) y 1,43 (Traveler PT-BR). Ninguno llegaba a 2,5, asi que el
  // gate pedia a un A1 algo que no ha hecho nunca un A1, ni siquiera el que
  // esta vivo. Suelo 1,6: por debajo del publicado, con el mismo criterio con
  // el que se puso el 3,0 de A0 (por debajo de los tres publicados: 4,21, 3,17
  // y 3,09). Que sea menos de la mitad que en A0 no esta explicado; lo honesto
  // es medirlo, no adivinar por que.
  const MEDIA_MINIMA: Record<string, number> = { A0: 3.0, A1: 1.6 };
  const suelo = MEDIA_MINIMA[level];
  if (suelo === undefined) {
    noImpl("journey-vocab-recirculation", "Cada plaza de vocab se reencuentra",
      `Sin umbral calibrado para ${level || "?"}: el catalogo en ese nivel va de 0,8 a 1,5 y no hay un buen precedente del que sacar el liston. Medir antes de gatear.`);
  } else if (!stories.some((s) => s.vocab && s.vocab.length)) {
    noImpl("journey-vocab-recirculation", "Cada plaza de vocab se reencuentra",
      "No se paso el vocab de las historias; sin el no se puede contar un encuentro.");
  } else {
    const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
    const cuerpos = stories.map((s) => new Set(tok(s.text)));
    const clave = (v: { word: string; surface?: string | null }) =>
      String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
    const enc: number[] = [];
    for (const s of stories) for (const v of s.vocab ?? [])
      enc.push(cuerpos.filter((c) => c.has(clave(v))).length);
    const media = enc.length ? enc.reduce((a, b) => a + b, 0) / enc.length : 0;
    const unaVez = enc.filter((n) => n <= 1).length;
    push("journey-vocab-recirculation", `Cada plaza de vocab se reencuentra (media ${suelo} o mas en ${level})`,
      media >= suelo,
      `media ${media.toFixed(2)} encuentros por plaza (ideal 4, liston de los buenos ${suelo}) · ${unaVez}/${enc.length} salen una sola vez`);
  }

  // ── 13. El RENDER, no el texto ─────────────────────────────
  //
  // Todos los demas checks miden el texto guardado. Este mide lo que el lector
  // pinta: `renderedParagraphs` reagrupa la prosa narrada de tres oraciones en
  // tres, y un bloque no puede quedarse con media replica. El 2026-08-23 el
  // Traveler DE A0 tenia 32 bloques asi y no lo veia nadie, porque en el texto
  // la replica esta entera; solo se parte al pintarla.
  {
    const PARES: Array<[string, string]> = [["\u201C", "\u201D"], ["\u00AB", "\u00BB"]];
    const rotos: string[] = [];
    for (const s of stories) {
      for (const [i, b] of renderedParagraphs(s.text).entries()) {
        for (const [abre, cierra] of PARES) {
          if (!s.text.includes(abre)) continue;
          const na = (b.split(abre).length - 1), nc = (b.split(cierra).length - 1);
          if (na !== nc) rotos.push(`${s.slug} bloque ${i + 1}: ${b.slice(0, 60)}`);
        }
      }
    }
    push("journey-render-quotes", "Ningun bloque del lector parte una linea citada",
      rotos.length === 0, `${rotos.length} bloque(s): ${rotos.slice(0, 4).join(" | ")}`);
  }

  // ── El inventario manda: una regla declarada sin check es un fallo ──
  {
    const declaradas = (rulesDoc.rules as Array<{ id: string; gate: string }>)
      .filter((r) => r.gate === "journey").map((r) => r.id);
    const implementadas = new Set(out.map((c) => c.id));
    const sinCheck = declaradas.filter((id) => !implementadas.has(id) && !(id === "journey-a0-floor" && level !== "A0"));
    push("journey-rules-inventory", "Toda regla de docs/story-rules.json tiene su check",
      sinCheck.length === 0,
      `Declaradas en docs/story-rules.json y sin implementar: ${sinCheck.join(", ")}`);
  }

  return out;
}
