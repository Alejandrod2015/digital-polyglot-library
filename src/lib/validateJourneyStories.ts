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

export type JourneyStoryInput = {
  slug: string;
  title: string;
  text: string;
  language: string;
  level: string;
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
const HABLA = "sagt|fragt|antwortet|ruft|nickt|lacht|schweigt|schreibt|erzählt|flüstert|zählt";
function castOf(stories: JourneyStoryInput[]): string[] {
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
  const ART = /\b(der|die|das|den|dem|des|ein|eine|einen|einem|einer|zum|zur|im|am|beim|vom|le|la|les|un|une|du|el|los|las|il|lo|gli)\s+$/i;
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

/** Forma de la apertura: que clase de sujeto abre la primera frase. */
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
  ctx: { language: string; level: string }
): JourneyCheck[] {
  const out: JourneyCheck[] = [];
  const lang = (ctx.language || "").toUpperCase();
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

  const cast = castOf(stories);

  // ── 2 y 3. Presentacion de personajes y variedad de forma ───
  if (lang !== "DE") {
    const why = `El detector de presentacion solo esta escrito para DE; este journey es ${lang || "?"}. ` +
      `Un check que no sabe medir NO puede pasar: implementa las tres formas para ${lang} en FORMAS_DE.`;
    noImpl("journey-character-introduction", "Cada personaje presentado antes de su primera cita", why);
    noImpl("journey-introduction-form-variety", "Las tres formas de presentacion se alternan", why);
  } else {
    const formas: string[] = [];
    const malos: string[] = [];
    for (const n of cast) {
      const primera = stories.find((s) => new RegExp(`\\b${n}\\b`, "u").test(s.text));
      if (!primera) continue;
      const t = primera.text;
      const forma = FORMAS_DE.find(([, re]) => re(n).test(t));
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
      const f = openingShape(s.text);
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
    if (lang !== "DE") {
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
