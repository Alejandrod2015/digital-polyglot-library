/**
 * Portón de temas: un tema de journey no se crea sin una motivación real de
 * usuario detrás.
 *
 * WHY (2026-08-17): al montar el Friends ES/Spain A1 saqué dos de los siete
 * temas de `BetaSignup.motivation` y los otros cinco del molde de cualquier
 * curso de principiante. "Chemist & Doctor" prometía un médico que no salía en
 * ninguna historia; "Shops & Markets" repetía dos temas que el A0 del mismo
 * idioma ya cubría. El fallo solo se ve leyendo los siete juntos, y para
 * entonces ya hay 21 historias escritas.
 *
 * WHY (2026-08-19): el portón daba por evidencia cualquier valor de
 * `BetaSignup.motivation`, y ese campo es un DESPLEGABLE de seis opciones
 * (`BETA_MOTIVATIONS`), no texto libre. Se propusieron los siete temas de un
 * Expat francés citando seis de ellos la misma cadena "move abroad", y pasaron
 * los siete: un clic de dos palabras valía por siete decisiones de contenido,
 * que es exactamente el molde de curso que esto existe para impedir. Ahora los
 * clics del desplegable NO son corpus, y una cita tiene un largo mínimo.
 *
 * Hace UNA cosa: comprueba que cada tema cite, literalmente, algo que un
 * usuario ESCRIBIÓ. Las reglas de nombre viven en la tabla de la spec y en el
 * validador; no se duplican aquí.
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
  /** citas VERBATIM de BetaSignup.motivation o .applicationReason */
  evidence: string[];
};

export class TopicEvidenceError extends Error {}

export async function assertTopicsGrounded(opts: {
  language: string;
  proposals: TopicProposal[];
  /** labels que ya usan otros journeys del mismo idioma, para comparar */
  existingLabels?: string[];
  prisma?: PrismaClient;
}): Promise<void> {
  const prisma = opts.prisma ?? new PrismaClient();

  // El campo es `targetLanguage`, no `language`, y el filtro va en JS porque
  // no es una columna de texto libre.
  const all = await prisma.betaSignup.findMany({
    select: { targetLanguage: true, motivation: true, learningGoal: true, applicationReason: true },
  });
  const wanted = opts.language.toLowerCase();
  const rows = all.filter((r) => String(r.targetLanguage ?? "").toLowerCase() === wanted);

  // `motivation` es un desplegable: solo cuenta como evidencia lo que la
  // persona ESCRIBIÓ, que es lo que llega por la opción "Other" (el formulario
  // guarda el texto, nunca la palabra "Other"). `applicationReason` sí es
  // texto libre y cuenta entero.
  let cannedClicks = 0;
  const writtenMotivations: string[] = [];
  const reasons: string[] = [];
  for (const r of rows) {
    // Antes del 2026-08-19, elegir "Other" guardaba el texto AQUÍ; desde
    // entonces vive en `learningGoal` y este campo es siempre el clic.
    const m = String(r.motivation ?? "").trim();
    if (m) {
      if (isCannedMotivation(m)) cannedClicks++;
      else writtenMotivations.push(m);
    }
    const g = String(r.learningGoal ?? "").trim();
    if (g) writtenMotivations.push(g);
    const a = String(r.applicationReason ?? "").trim();
    if (a) reasons.push(a);
  }
  const written = writtenMotivations.concat(reasons);
  const corpus = written.map(norm);

  if (corpus.length === 0) {
    throw new TopicEvidenceError(
      `Cero frases escritas de ${opts.language} en BetaSignup: ${rows.length} solicitudes, ` +
      `${cannedClicks} motivaciones son clics del desplegable y ninguna dice de qué habla la ` +
      `persona. Sin datos no se eligen temas.`,
    );
  }

  // Reglas de nombre comprobables desde la cadena. Las de criterio (que nombre
  // el dominio y no el sitio, el nivel de abstracción, que no sea una ciudad
  // disfrazada) no se pueden medir: para esas, la tabla que se imprime abajo.
  const nameProblems = opts.proposals.flatMap((p) => {
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

  const bad = nameProblems.concat(opts.proposals.flatMap((p) => {
    if (!p.evidence?.length) return [`"${p.label}": ninguna cita de usuario`];
    const out: string[] = [];
    const short = p.evidence.filter((q) => quoteTooShort(q));
    if (short.length) {
      out.push(
        `citas demasiado cortas para sostener un tema (mínimo ${MIN_QUOTE_WORDS} palabras y ` +
        `${MIN_QUOTE_CHARS} caracteres): ${short.join(" / ")}`,
      );
    }
    const fake = p.evidence
      .filter((q) => !quoteTooShort(q))
      .filter((q) => !corpus.some((c) => c.includes(norm(q))));
    if (fake.length) out.push(`citas que nadie escribió en BetaSignup: ${fake.join(" / ")}`);
    // Una cita corta y otra inventada dejan el tema sin NINGUNA cita válida.
    if (!out.length) return [];
    return [`"${p.label}": ${out.join("; ")}`];
  }));

  // La tabla que faltaba: cada tema con cuánta gente hay detrás de su cita, y
  // al lado lo que YA cubren los otros journeys del idioma. Los fallos de
  // criterio ("Chemist" junto a "Health & Emergencies", con un solo
  // solicitante detrás) solo se ven comparando; sin esto se eligen a ciegas.
  console.log(
    `\nTEMAS PROPUESTOS · ${corpus.length} frases escritas de ${opts.language} ` +
    `(${writtenMotivations.length} escritas en learningGoal + ${reasons.length} applicationReason; ` +
    `${cannedClicks} clics del desplegable descartados)`,
  );
  for (const p of opts.proposals) {
    const n = p.evidence
      .filter((q) => !quoteTooShort(q))
      .reduce((acc, q) => acc + corpus.filter((c) => c.includes(norm(q))).length, 0);
    console.log(`  ${p.label.padEnd(30)} ${String(n).padStart(3)} solicitantes  <- ${p.evidence.join(" / ")}`);
  }
  if (opts.existingLabels?.length) {
    console.log(`\n  Ya cubierto en ${opts.language}: ${opts.existingLabels.join(" · ")}`);
  }
  console.log("");

  if (bad.length) {
    throw new TopicEvidenceError(
      `TEMAS SIN RESPALDO:\n  - ${bad.join("\n  - ")}\n\n` +
      `Hay ${writtenMotivations.length} frases de learningGoal y ${reasons.length} applicationReason ` +
      `de ${opts.language} (${cannedClicks} clics del desplegable no cuentan). ` +
      `Corre \`npx tsx scripts/userEvidence.ts ${opts.language}\` y elige desde ahí.`,
    );
  }
}
