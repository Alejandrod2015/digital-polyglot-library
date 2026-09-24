import type { JourneyStoryInput } from "../src/lib/validateJourneyStories";
export const HABLA_POR_IDIOMA: Record<string, string> = {
  DE: "sagt|fragt|antwortet|ruft|nickt|lacht|schweigt|schreibt|erzählt|flüstert|zählt",
  // Portugues: presente Y preterito, porque desde el 2026-08-19 la ultima
  // historia de cada tema se narra en pasado y con solo el presente el reparto
  // salia vacio (`protagonista ?`).
  PT: "diz|disse|pergunta|perguntou|responde|respondeu|avisa|avisou|repete|repetiu|conta|contou|explica|explicou|grita|gritou|chama|chamou|pede|pediu|ri|riu|ensina|ensinou|escreve|escreveu",
  // Frances (2026-08-23; pasado añadido 2026-09-14, ver [[project_journey_fr_a0_friends_marseille]]).
  // Sin el presente el reparto salia vacio y el cierre a solas decia
  // "protagonista ?" en las 21: castOf caia en la lista alemana. Sin el
  // PASADO, una historia narrada en passe compose/imparfait ("a dit",
  // "répondait") no casaba con nada de la lista y el reparto salia vacio
  // otra vez, el mismo fallo con otra cara: castOf mide presente y pasado
  // (compose con auxiliar, imperfecto, simple) de los mismos quince verbos.
  FR: "dit|demande|répond|ajoute|explique|répète|crie|écrit|raconte|promet|rit|appelle|propose|corrige|note|" +
      // passe compose: auxiliar (avoir, todos estos verbos) + participio
      "a dit|ont dit|a demandé|ont demandé|a répondu|ont répondu|a ajouté|ont ajouté|" +
      "a expliqué|ont expliqué|a répété|ont répété|a crié|ont crié|a écrit|ont écrit|" +
      "a raconté|ont raconté|a promis|ont promis|a ri|ont ri|a appelé|ont appelé|" +
      "a proposé|ont proposé|a corrigé|ont corrigé|a noté|ont noté|" +
      // imparfait
      "disait|demandait|répondait|ajoutait|expliquait|répétait|criait|écrivait|" +
      "racontait|promettait|riait|appelait|proposait|corrigeait|notait|" +
      // passe simple (3a sg y pl, el que usa un narrador)
      "dirent|demanda|demandèrent|répondit|répondirent|ajouta|ajoutèrent|" +
      "expliqua|expliquèrent|répéta|répétèrent|cria|crièrent|écrivit|écrivirent|" +
      "raconta|racontèrent|promit|promirent|rirent|appela|appelèrent|" +
      "proposa|proposèrent|corrigea|corrigèrent|nota|notèrent",
  // Espanol (2026-08-31). Sin esta lista `castOf` caia en la alemana y el
  // reparto salia VACIO en los ocho journeys de espanol, que es el mismo fallo
  // que se arreglo en portugues y en frances. Presente Y preterito, porque la
  // ultima historia de un tema se narra a menudo en pasado.
  ES: "dice|dijo|pregunta|pregunto|preguntó|responde|respondio|respondió|contesta|contesto|contestó|" +
      "cuenta|conto|contó|explica|explico|explicó|repite|repitio|repitió|avisa|aviso|avisó|" +
      "grita|grito|gritó|llama|llamo|llamó|pide|pidio|pidió|insiste|insistio|insistió|" +
      "agrega|agrego|agregó|escribe|escribio|escribió|suelta|solto|soltó|corrige|corrigio|corrigió",
  // Italiano (2026-09-14, Friends IT A0 de Genova; ampliado 2026-09-17 con el
  // IT A2 y el IT A1 de Milano). Sin esta lista castOf caia en la alemana y
  // el reparto salia VACIO, el mismo fallo de PT, FR y ES. Union de los
  // verbos de habla del A0 (presente, suelo A0), los que anadio el A2
  // (corregge, decide, indica) y el passato prossimo del A1 (una historia con
  // "ha detto" no casaba con nada y dejaba el reparto vacio otra vez, con los
  // checks de reparto pasando sin medir; mismos veinte verbos, avere en
  // singular y plural).
  IT: "dice|chiede|domanda|risponde|aggiunge|spiega|ripete|grida|urla|scrive|racconta|promette|ride|chiama|propone|legge|sussurra|continua|conferma|saluta|corregge|decide|indica|" +
      "ha detto|hanno detto|ha chiesto|hanno chiesto|ha domandato|hanno domandato|ha risposto|hanno risposto|" +
      "ha aggiunto|hanno aggiunto|ha spiegato|hanno spiegato|ha ripetuto|hanno ripetuto|ha gridato|hanno gridato|" +
      "ha urlato|hanno urlato|ha scritto|hanno scritto|ha raccontato|hanno raccontato|ha promesso|hanno promesso|" +
      "ha riso|hanno riso|ha chiamato|hanno chiamato|ha proposto|hanno proposto|ha letto|hanno letto|" +
      "ha sussurrato|hanno sussurrato|ha continuato|hanno continuato|ha confermato|hanno confermato|ha salutato|hanno salutato",
};
export function castOf(stories: JourneyStoryInput[], lang: string): string[] {
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
  return castLegacy(stories, lang).filter((n) => hablan.has(n));
}
export function castLegacy(stories: JourneyStoryInput[], lang = ""): string[] {
  // OJO CON LA `a` Y LA `o`: son articulos en portugues y PREPOSICION y
  // CONJUNCION en espanol. Con la lista comun, "presenta a Marisol",
  // "pregunta a Yolanda" o "busca a Fabian" metian a todo el reparto en
  // `conArticulo`, que lo expulsa del cast para siempre. Resultado medido el
  // 2026-09-01: el reparto salia VACIO en espanol y los cuatro checks de
  // reparto pasaban sin medir nada, que es peor que fallar.
  const SOLO_PT = lang === "ES" || lang === "FR" || lang === "IT" ? "" : "|o|a|os|as|um|uma";
  const ART = new RegExp(
    // (?<!\\p{L}) y no \\b: la frontera ASCII casaba el «o» FINAL de «então»
    // como articulo y expulsaba del reparto a quien viniera detras (bug PT B1,
    // 2026-09-06; mismo mal que el detector de presentaciones).
    `(?<!\\p{L})(der|die|das|den|dem|des|ein|eine|einen|einem|einer|zum|zur|im|am|beim|vom|` +
    `le|la|les|un|une|du|el|los|las|il|lo|gli${SOLO_PT})\\s+$`, "iu");
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

