/**
 * cierraTema: "listo" deja de ser una frase y pasa a ser un REGISTRO (I3).
 *
 *   npx tsx scripts/cierraTema.ts <journeyId> <tema>
 *   npx tsx scripts/cierraTema.ts --json <fichero> [--lang ES] [--level a2] [--variant LATAM]
 *
 * Corre TODAS las comprobaciones aplicables a un tema y, solo si pasan todas,
 * escribe una entrada en scripts/tema-cierres.json con el hash del contenido de
 * las tres historias. Ese registro es lo que mira el candado de saveStory.ts
 * antes de dejar guardar el tema siguiente: si el texto del tema cerrado
 * cambia, el hash deja de cuadrar y el cierre caduca solo.
 *
 * QUE COMPRUEBA
 *   - el validador canonico (validateGeneratedStory) sobre las tres, en seco y
 *     cada una contra sus hermanas, que es como las juzga saveStory;
 *   - guiones largos y emojis en titulo y cuerpo, que en la base no los mira
 *     ningun lint de ficheros;
 *   - acotacion: cuanta habla citada lleva al narrador al lado (solo avisa, no
 *     bloquea: la regla no tiene gate y decir lo contrario seria mentir);
 *   - la escalera de vocab del tema, informativa: la de verdad es del journey
 *     entero y por eso sale como pendiente de conjunto.
 *
 * EL MODO --json existe para poder probar el cierre con fixtures donde no hay
 * base de datos. El fichero puede ser un array de historias, o un objeto
 * { journeyId, topic, language, level, variant, stories: [...] }.
 */
// Neutraliza el guard `server-only`, igual que saveStory.ts: el validador
// canonico importa el juez CEFR, que lo usa. Tiene que ir ANTES del import del
// validador, que es lo que dispara la cadena.
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = {
    id: p, filename: p, loaded: true, exports: {},
  };
} catch { /* noop */ }

import * as fs from "fs";
import {
  validateGeneratedStory, extractStoryMotifs, extractProperNouns,
  type ExistingStorySummary,
} from "@/lib/validateGeneratedStory";
import { validateJourneyStories } from "@/lib/validateJourneyStories";
import {
  hashTema, escribirCierre, type Cierre, type HistoriaCierre,
} from "./temaCierres";

type Historia = HistoriaCierre & {
  slug?: string | null;
  synopsis?: string | null;
  arcType?: string | null;
};

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

/** El mismo resumen entre hermanas que arma saveStory antes de validar. */
function resumen(d: Historia): ExistingStorySummary {
  const names = new Set<string>();
  for (const line of String(d.text ?? "").split(/\r?\n/)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+):\s/);
    if (m) names.add(m[1]);
  }
  for (const n of extractProperNouns(String(d.text ?? ""))) names.add(n);
  const primerParrafo = String(d.text ?? "").split(/\n{2,}/)[0] ?? "";
  return {
    title: String(d.title ?? ""),
    arcType: d.arcType ?? null,
    vocabLemmas: ((d.vocab as Array<{ word?: unknown }>) ?? []).map((v) => String(v?.word ?? "")),
    characterNames: [...names],
    openingFirstSentence: (primerParrafo.split(/(?<=[.!?])\s/)[0] ?? primerParrafo).trim(),
    motifTags: extractStoryMotifs(String(d.text ?? "")),
  };
}

// Los caracteres se construyen por codigo: escribirlos aqui romperia la misma
// regla que este check hace cumplir.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const GUIONES = new RegExp(`[${EM}${EN}]`, "g");
const EMOJI = /\p{Extended_Pictographic}/gu;

/** Proporcion de parrafos citados que llevan narracion al lado. */
function acotacion(textos: string[]): { citados: number; conNarrador: number } {
  const CITA = /“([^”]+)”/;
  let citados = 0, conNarrador = 0;
  for (const t of textos) {
    const ps = t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    ps.forEach((x, i) => {
      if (!CITA.test(x)) return;
      citados++;
      const propia = x.replace(new RegExp(CITA.source, "g"), " ").trim().split(/\s+/).filter(Boolean).length >= 2;
      const previa = i > 0 && !ps[i - 1].includes("“");
      if (propia || previa) conNarrador++;
    });
  }
  return { citados, conNarrador };
}

/** Encuentros por plaza dentro del tema. La escalera de verdad es del journey. */
function escaleraDelTema(hs: Historia[]): { media: number; plazas: number } {
  const tok = (t: string) => new Set((t.toLowerCase().match(/\p{L}+/gu) ?? []));
  const cuerpos = hs.map((s) => tok(String(s.text ?? "")));
  let suma = 0, plazas = 0;
  for (const s of hs)
    for (const v of ((s.vocab as Array<{ word?: unknown; surface?: unknown }>) ?? [])) {
      const k = String(v?.surface ?? v?.word ?? "").toLowerCase();
      if (!k) continue;
      plazas++;
      suma += cuerpos.filter((c) => c.has(k)).length;
    }
  return { media: plazas ? suma / plazas : 0, plazas };
}

async function desdeBase(journeyId: string, topic: string) {
  const { config } = await import("dotenv");
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
  const { PrismaClient } = await import("../src/generated/prisma");
  const p = new PrismaClient();
  try {
    const j = await p.journey.findUnique({
      where: { id: journeyId },
      select: { language: true, variant: true, levels: true, topics: true, storiesPerTopic: true },
    });
    if (!j) throw new Error(`no encuentro el journey ${journeyId}`);
    if (!j.topics.includes(topic))
      throw new Error(`el tema "${topic}" no es de este journey. Sus temas: ${j.topics.join(", ")}`);
    const filas = await p.journeyStory.findMany({
      where: { journeyId, topic },
      select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true,
                synopsis: true, arcType: true },
      orderBy: { slotIndex: "asc" },
    });
    const total = await p.journeyStory.count({ where: { journeyId, text: { not: null } } });
    // Personas REALES, igual que en saveStory: sin la lista el check de
    // personajes no puede medir y devuelve `not-implemented`, que bloquea.
    const realPeople = (await p.betaSignup.findMany({ select: { email: true } }))
      .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
      .filter((w) => w.length >= 3)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    return {
      historias: filas as Historia[],
      language: j.language, level: (j.levels ?? [])[0] ?? "", variant: j.variant ?? "",
      esperadas: j.storiesPerTopic ?? 3,
      historiasDelJourney: total,
      realPeople,
    };
  } finally {
    await p.$disconnect();
  }
}

function desdeJson(fichero: string) {
  const raw = JSON.parse(fs.readFileSync(fichero, "utf8"));
  const obj = Array.isArray(raw) ? { stories: raw } : raw;
  const historias = (obj.stories ?? []) as Historia[];
  return {
    historias,
    journeyId: arg("journey", obj.journeyId) ?? "",
    topic: arg("topic", obj.topic ?? historias[0]?.topic) ?? "",
    language: arg("lang", obj.language) ?? "ES",
    level: arg("level", obj.level) ?? "",
    variant: arg("variant", obj.variant) ?? "",
    esperadas: Number(obj.storiesPerTopic ?? 3),
    historiasDelJourney: Number(obj.historiasDelJourney ?? historias.length),
    realPeople: obj.realPeople as string[] | undefined,
  };
}

(async () => {
  const modoJson = process.argv.includes("--json");
  let journeyId: string, topic: string;
  let datos: {
    historias: Historia[]; language: string; level: string; variant: string;
    esperadas: number; historiasDelJourney: number; realPeople?: string[];
  };

  if (modoJson) {
    const d = desdeJson(arg("json")!);
    journeyId = d.journeyId; topic = d.topic; datos = d;
    if (!journeyId || !topic) {
      console.error("cierraTema: el fixture necesita journeyId y topic (en el fichero o con --journey/--topic).");
      process.exit(2);
    }
  } else {
    journeyId = process.argv[2]; topic = process.argv[3];
    if (!journeyId || !topic || journeyId.startsWith("--")) {
      console.error("uso: cierraTema.ts <journeyId> <tema>");
      console.error("     cierraTema.ts --json <fichero> [--lang ES] [--level a2] [--variant LATAM]");
      process.exit(2);
    }
    datos = await desdeBase(journeyId, topic);
  }

  const { historias, language, level, variant, esperadas, historiasDelJourney, realPeople } = datos;
  const conTexto = historias.filter((s) => String(s.text ?? "").trim());
  const fallos: string[] = [];
  const checks: string[] = [];
  const pendientes: string[] = [];

  console.log(`\n── cierre del tema "${topic}" · journey ${journeyId} ──`);
  console.log(`   ${conTexto.length}/${esperadas} historias con texto · ${language} ${level} ${variant}`);

  if (conTexto.length < esperadas)
    fallos.push(`el tema tiene ${conTexto.length} historias con texto y necesita ${esperadas}`);

  // ── 1. Validador canonico, en seco, cada una contra sus hermanas ──
  //
  // `--narrator` exime EXACTAMENTE los tres checks que saveStory exime en
  // perfil narrador, y ninguno mas: los tres leen turnos "Personaje: linea",
  // que la prosa narrada no tiene. Cierra con otra lista y el cierre pediria a
  // una historia narrada algo que el guardado no le pide.
  const narrador = process.argv.includes("--narrator");
  const EXENTOS_NARRADOR = new Set(["body-dialogue-ratio", "speakers-count", "speaker-lines"]);
  const previas: ExistingStorySummary[] = [];
  let okCanonico = 0;
  for (const d of conTexto) {
    const r = await validateGeneratedStory(
      { title: d.title, synopsis: d.synopsis, text: d.text, vocab: d.vocab, arcType: d.arcType } as never,
      {
        language, level, variant, topic,
        journeyTitles: conTexto.map((x) => String(x.title ?? "")).filter((t) => t !== d.title),
        existing: [...previas],
      } as never
    );
    previas.push(resumen(d));
    const malos = r.checks.filter(
      (c) => c.status === "fail" && !(narrador && EXENTOS_NARRADOR.has(c.id))
    );
    if (!malos.length) okCanonico++;
    else
      for (const c of malos)
        fallos.push(`[canonico ${d.topic}#${d.slotIndex}] ${c.id}: ${c.detail ?? c.label}`);
  }
  checks.push(`validador canonico: ${okCanonico}/${conTexto.length}${narrador ? " (perfil narrador)" : ""}`);
  console.log(`   [canonico]  ${okCanonico}/${conTexto.length} historias limpias${narrador ? " [narrator]" : ""}`);
  // El solape con OTROS journeys lo mide saveStory al guardar, con la base
  // delante. Aqui no se puede, y decir "limpio" seria decir de mas.
  pendientes.push("solape de vocab contra otros journeys (lo mide saveStory al guardar)");

  // ── 2. Guiones largos y emojis, en el CONTENIDO ──
  for (const d of conTexto) {
    const donde = `${d.topic}#${d.slotIndex}`;
    const texto = `${d.title ?? ""}\n${d.text ?? ""}\n${JSON.stringify(d.vocab ?? [])}`;
    const g = texto.match(GUIONES) ?? [];
    if (g.length) fallos.push(`[guiones] ${donde}: ${g.length} guion(es) largo(s) en el contenido`);
    const e = texto.match(EMOJI) ?? [];
    if (e.length) fallos.push(`[emojis] ${donde}: ${[...new Set(e)].join(" ")}`);
  }
  checks.push("sin guiones largos ni emojis en el contenido");
  console.log(`   [tipografia] guiones largos y emojis: ${fallos.some((f) => /^\[(guiones|emojis)\]/.test(f)) ? "HAY" : "limpio"}`);

  // ── 3. Acotacion. Solo avisa: la regla no tiene gate y fingir que si lo
  //      tiene seria justo lo que este trabajo vino a quitar de en medio.
  const ac = acotacion(conTexto.map((s) => String(s.text ?? "")));
  if (ac.citados) {
    const pct = Math.round((ac.conNarrador / ac.citados) * 100);
    console.log(`   [acotacion] ${pct}% de los parrafos citados llevan narrador al lado (${ac.conNarrador}/${ac.citados}); solo avisa`);
    checks.push(`acotacion ${pct}% (solo avisa)`);
  } else {
    console.log("   [acotacion] no hay parrafos con habla citada");
  }

  // ── 4. Escalera de vocab del tema, informativa ──
  const esc = escaleraDelTema(conTexto);
  console.log(`   [escalera]  ${esc.media.toFixed(2)} encuentros por plaza dentro del tema (${esc.plazas} plazas)`);
  pendientes.push(
    `escalera de recirculacion del journey (medida sobre las ${historiasDelJourney} historias escritas, ` +
    "se juzga con el journey completo)"
  );

  // ── 5. Gate de conjunto, con las historias que HAY ──
  //
  // Desde el 2026-09-05 el checker de journey no se salta con el conjunto a
  // medias: los checks prefix-safe (los que no se arreglan añadiendo
  // historias) corren sobre las tres del tema, y los de conjunto devuelven
  // `pending-set`, que aqui se imprime como pendiente. Un tema cerrado no es
  // un journey aprobado, y eso se dice, no se calla.
  const jc = validateJourneyStories(
    conTexto.map((s) => ({
      slug: String(s.slug ?? `${s.topic}#${s.slotIndex}`),
      title: String(s.title ?? ""),
      text: String(s.text ?? ""),
      vocab: s.vocab as never,
      language, level, topic: s.topic,
    })),
    { language, level, realPeople, conjuntoCompleto: false }
  );
  console.log("");
  for (const c of jc) {
    const marca = c.status === "pass" ? "ok  " : c.status === "fail" ? "FAIL"
      : c.status === "pending-set" ? "espera" : "SIN IMPLEMENTAR";
    console.log(`   [conjunto] ${marca} ${c.id} ${c.detail ?? ""}`);
    if (c.status === "fail") fallos.push(`[conjunto] ${c.id}: ${c.detail ?? c.label}`);
    else if (c.status === "pending-set") pendientes.push(`${c.id}: ${c.detail ?? ""}`);
    else if (c.status === "not-implemented") {
      // En modo fixture no hay base, y varios checks necesitan datos que solo
      // estan ahi (la lista de solicitantes, por ejemplo). Eso no se puede
      // llamar aprobado: se lista como pendiente, diciendo por que.
      if (modoJson) pendientes.push(`${c.id} (modo fixture, sin base de datos): ${c.detail ?? ""}`);
      else fallos.push(`[conjunto] ${c.id} no se pudo medir: ${c.detail ?? c.label}`);
    }
  }
  checks.push(`gate de conjunto sobre el tema: ${jc.filter((c) => c.status === "pass").length}/${jc.length} medidos y limpios`);

  console.log("");
  for (const p of pendientes) console.log(`   pendiente de conjunto: ${p}`);

  if (fallos.length) {
    console.error(`\n✗ EL TEMA NO SE CIERRA: ${fallos.length} fallo(s). NADA ESCRITO EN EL REGISTRO.\n`);
    for (const f of fallos) console.error("   " + f);
    console.error("\n   Arregla la historia, no el gate. Cuando pase, vuelve a correr este comando.");
    process.exit(1);
  }

  const cierre: Cierre = {
    cerrado: new Date().toISOString(),
    hash: hashTema(conTexto),
    historias: conTexto.map((s) => `${s.topic}#${s.slotIndex} ${s.slug ?? s.title ?? ""}`.trim()),
    checks,
    pendientesDeConjunto: pendientes,
  };
  escribirCierre(journeyId, topic, cierre);
  console.log(`\n✓ TEMA CERRADO. Registrado en scripts/tema-cierres.json (hash ${cierre.hash}).`);
  console.log("   Eso, y no una frase, es lo que hace que el tema cuente como listo.");
})();
