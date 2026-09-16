/**
 * Pista de temas: las motivaciones escritas por los solicitantes INSPIRAN los
 * temas de un journey; no los autorizan ni los vetan.
 *
 * WHY (2026-09-15, decision del usuario, literal): "La motivación de unos
 * cuántos beta testers no puede ser un filtro, solo una pista." Hasta ese dia
 * esto era un porton que TIRABA si un tema no citaba una frase de BetaSignup.
 * Ahora el informe se imprime y avisa de los temas sin cita, y no tira por
 * eso. La demanda por idioma sigue sirviendo para decidir QUE journey crear;
 * el contenido de sus temas ya no depende de que un beta lo haya escrito.
 *
 * Historia del porton, por si vuelve a hacer falta leer las citas con cuidado:
 * el 2026-08-17 cinco de los siete temas del Friends ES/Spain A1 salieron del
 * molde de un curso de principiante, y el 2026-08-19 se vio que los clics del
 * desplegable (`BETA_MOTIVATIONS`) pasaban por evidencia. Por eso el informe
 * sigue descartando los clics y midiendo el largo de cada cita.
 *
 * Lo que SI sigue tirando son las reglas de NOMBRE comprobables desde la
 * cadena (2-4 palabras, "&", sin pais, sin articulo, Title Case, slug
 * derivado), que no dependen de ningun beta y no han cambiado.
 */
import { PrismaClient } from "@/generated/prisma";
import { isCannedMotivation, MIN_EVIDENCE_CHARS, MIN_EVIDENCE_WORDS, tooShortForEvidence } from "./betaMotivations";

/**
 * Largo mínimo de una cita, elegido mirando las citas reales de la base y no
 * de memoria. Las frases que de verdad sostienen un tema son de este tamaño o
 * mayores: "talk to neighbours" (3 palabras, 18), "only speaks Spanish" (19),
 * "move there in 6-8 months" (24), "full business meetings" (22). Por debajo
 * solo caben las etiquetas genéricas ("work", "move abroad", "my job"), que
 * respaldan cualquier tema y por tanto no respaldan ninguno.
 */
const MIN_QUOTE_WORDS = MIN_EVIDENCE_WORDS;
const MIN_QUOTE_CHARS = MIN_EVIDENCE_CHARS;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const quoteTooShort = (q: string) => tooShortForEvidence(q);

export type TopicProposal = {
  label: string;
  /** slug con el que se guardará; tiene que derivar del label */
  slug?: string;
  /** citas VERBATIM de BetaSignup.motivation o .applicationReason. Opcional
   *  solo en modo journey-level, donde las citas se declaran una vez arriba. */
  evidence?: string[];
};

/** Solo la tiran las reglas de NOMBRE. La falta de cita ya no tira nada. */
export class TopicEvidenceError extends Error {}

export type TopicEvidenceOptions = {
  language: string;
  proposals: TopicProposal[];
  /** labels que ya usan otros journeys del mismo idioma, para comparar */
  existingLabels?: string[];
  /**
   * MODO JOURNEY-LEVEL para corpus chicos (2026-09-06). Citas VERBATIM que
   * inspiran el journey ENTERO; los temas son los dominios de esas citas y no
   * citan por separado. En portugues, de 9 solicitantes solo dos escribieron
   * sobre su vida: repartir dos frases entre siete temas disimula la escasez,
   * y este modo la declara.
   */
  journeyEvidence?: string[];
  prisma?: PrismaClient;
};

export type TopicEvidenceReport = {
  language: string;
  /** frases escritas (sin clics del desplegable) */
  corpusSize: number;
  writtenMotivations: number;
  applicationReasons: number;
  cannedClicks: number;
  journeyLevel: boolean;
  /** personas detras de las citas del journey (solo modo journey-level) */
  journeyPeople: number;
  topics: Array<{
    label: string;
    evidence: string[];
    /** cuantas frases del corpus contienen alguna de sus citas validas */
    applicants: number;
    /** true si tiene al menos una cita verbatim con el largo minimo */
    cited: boolean;
  }>;
  /** avisos de evidencia: temas sin cita, citas cortas o inventadas. NO bloquean. */
  evidenceWarnings: string[];
  /** reglas de nombre incumplidas. Estas SI bloquean en assertTopicsGrounded. */
  nameProblems: string[];
};

/** Reglas de nombre comprobables desde la cadena. No dependen de BetaSignup. */
export function topicNameProblems(proposals: TopicProposal[]): string[] {
  return proposals.flatMap((p) => {
    const w = p.label.trim().split(/\s+/);
    const out: string[] = [];
    if (w.length < 2 || w.length > 4) out.push(`${w.length} palabras (2-4)`);
    if (/\band\b/i.test(p.label)) out.push('usa "And" en vez de "&"');
    if (/\b(spanish|mexican|colombian|argentin\w+|peruvian|chilean|german|italian|french|portuguese|brazilian|spain|mexico|colombia|argentina|peru|chile|germany|italy|france|portugal|brazil)\b/i.test(p.label))
      out.push("lleva el país o el gentilicio");
    if (/^(the|a|an|el|la|los|las|un|una)\b/i.test(p.label)) out.push("empieza por artículo");
    const badCase = w.filter((x) => x !== "&" && !/^(of|for|in|on|at|to)$/i.test(x) && !/^[A-ZÁÉÍÓÚÑ]/.test(x));
    if (badCase.length) out.push(`sin Title Case: ${badCase.join(", ")}`);
    if (p.slug) {
      const derived = p.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (p.slug !== derived) out.push(`el slug "${p.slug}" no deriva del nombre (sería "${derived}")`);
    }
    return out.length ? [`"${p.label}": ${out.join("; ")}`] : [];
  });
}

/**
 * El informe: que tema cita que motivacion y cuales no. No imprime y no tira.
 */
export async function reportTopicEvidence(opts: TopicEvidenceOptions): Promise<TopicEvidenceReport> {
  const prisma = opts.prisma ?? new PrismaClient();

  // El campo es `targetLanguage`, no `language`, y el filtro va en JS porque
  // no es una columna de texto libre.
  const all = await prisma.betaSignup.findMany({
    select: { targetLanguage: true, motivation: true, learningGoal: true, applicationReason: true },
  });
  const wanted = opts.language.toLowerCase();
  const rows = all.filter((r) => String(r.targetLanguage ?? "").toLowerCase() === wanted);

  // `motivation` es un desplegable: solo cuenta lo que la persona ESCRIBIÓ,
  // que llega por la opción "Other". Antes del 2026-08-19 ese texto se
  // guardaba aquí; después en `learningGoal`, que dejó de preguntarse el
  // 2026-08-23. `applicationReason` es texto libre y cuenta entero.
  let cannedClicks = 0;
  const writtenMotivations: string[] = [];
  const reasons: string[] = [];
  /** Lo que escribio CADA persona, para poder contar personas y no frases. */
  const porPersona: string[][] = [];
  for (const r of rows) {
    const m = String(r.motivation ?? "").trim();
    if (m) {
      if (isCannedMotivation(m)) cannedClicks++;
      else writtenMotivations.push(m);
    }
    const g = String(r.learningGoal ?? "").trim();
    if (g) writtenMotivations.push(g);
    const a = String(r.applicationReason ?? "").trim();
    if (a) reasons.push(a);
    const suyas = [m && !isCannedMotivation(m) ? m : "", g, a].filter(Boolean).map(norm);
    if (suyas.length) porPersona.push(suyas);
  }
  const corpus = writtenMotivations.concat(reasons).map(norm);
  const enCorpus = (q: string) => corpus.some((c) => c.includes(norm(q)));

  const evidenceWarnings: string[] = [];
  if (corpus.length === 0) {
    evidenceWarnings.push(
      `cero frases escritas de ${opts.language} en BetaSignup (${rows.length} solicitudes, ` +
      `${cannedClicks} clics del desplegable): no hay pistas, los temas salen de otro criterio`,
    );
  }

  const modoJourney = Boolean(opts.journeyEvidence?.length);
  let journeyPeople = 0;
  if (modoJourney) {
    const citas = opts.journeyEvidence!;
    const cortas = citas.filter((q) => quoteTooShort(q));
    if (cortas.length)
      evidenceWarnings.push(
        `citas del journey demasiado cortas (minimo ${MIN_QUOTE_WORDS} palabras y ${MIN_QUOTE_CHARS} caracteres): ${cortas.join(" / ")}`,
      );
    const inventadas = citas.filter((q) => !quoteTooShort(q) && !enCorpus(q));
    if (inventadas.length) evidenceWarnings.push(`citas del journey que nadie escribio en BetaSignup: ${inventadas.join(" / ")}`);
    journeyPeople = porPersona.filter((ps) =>
      citas.some((q) => !quoteTooShort(q) && ps.some((p) => p.includes(norm(q)))),
    ).length;
  }

  const topics = opts.proposals.map((p) => {
    const evidence = p.evidence ?? [];
    const validas = evidence.filter((q) => !quoteTooShort(q) && enCorpus(q));
    const applicants = validas.reduce((acc, q) => acc + corpus.filter((c) => c.includes(norm(q))).length, 0);
    if (!modoJourney) {
      const out: string[] = [];
      if (!evidence.length) out.push("ninguna cita de usuario");
      const short = evidence.filter((q) => quoteTooShort(q));
      if (short.length)
        out.push(`citas demasiado cortas (mínimo ${MIN_QUOTE_WORDS} palabras y ${MIN_QUOTE_CHARS} caracteres): ${short.join(" / ")}`);
      const fake = evidence.filter((q) => !quoteTooShort(q) && !enCorpus(q));
      if (fake.length) out.push(`citas que nadie escribió en BetaSignup: ${fake.join(" / ")}`);
      if (out.length && !validas.length) evidenceWarnings.push(`"${p.label}": ${out.join("; ")}`);
    }
    return { label: p.label, evidence, applicants, cited: validas.length > 0 };
  });

  return {
    language: opts.language,
    corpusSize: corpus.length,
    writtenMotivations: writtenMotivations.length,
    applicationReasons: reasons.length,
    cannedClicks,
    journeyLevel: modoJourney,
    journeyPeople,
    topics,
    evidenceWarnings,
    nameProblems: topicNameProblems(opts.proposals),
  };
}

/**
 * Imprime el informe de pistas y AVISA de los temas sin cita, sin tirar por
 * eso. Solo tira (`TopicEvidenceError`) si un nombre incumple las reglas de
 * nombre. Devuelve el informe por si quien llama quiere usarlo.
 */
export async function assertTopicsGrounded(opts: TopicEvidenceOptions): Promise<TopicEvidenceReport> {
  const r = await reportTopicEvidence(opts);

  console.log(
    `\nTEMAS PROPUESTOS · pistas: ${r.corpusSize} frases escritas de ${r.language} ` +
    `(${r.writtenMotivations} escritas a mano + ${r.applicationReasons} applicationReason; ` +
    `${r.cannedClicks} clics del desplegable descartados)`,
  );
  if (r.journeyLevel) {
    console.log(`  MODO JOURNEY-LEVEL · ${r.journeyPeople} persona(s) detras de las citas`);
    for (const q of opts.journeyEvidence!) console.log(`    <- ${q}`);
    console.log("");
    for (const t of r.topics) console.log(`  ${t.label.padEnd(30)} dominio`);
  } else {
    for (const t of r.topics) {
      const pista = t.cited ? `${String(t.applicants).padStart(3)} solicitantes` : "  sin pista    ";
      console.log(`  ${t.label.padEnd(30)} ${pista}  <- ${t.evidence.join(" / ")}`);
    }
  }
  if (opts.existingLabels?.length) {
    console.log(`\n  Ya cubierto en ${r.language}: ${opts.existingLabels.join(" · ")}`);
  }
  console.log("");

  if (r.evidenceWarnings.length) {
    console.warn(
      `AVISO (pista, no filtro): temas sin cita de BetaSignup\n  - ${r.evidenceWarnings.join("\n  - ")}\n` +
      `No bloquea. Si quieres pistas: \`npx tsx scripts/userEvidence.ts ${r.language}\`.\n`,
    );
  }

  if (r.nameProblems.length) {
    throw new TopicEvidenceError(`NOMBRES DE TEMA INVALIDOS:\n  - ${r.nameProblems.join("\n  - ")}`);
  }
  return r;
}
