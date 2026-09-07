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
  /** citas VERBATIM de BetaSignup.motivation o .applicationReason. Opcional
   *  solo en modo journey-level, donde las citas se declaran una vez arriba. */
  evidence?: string[];
};

export class TopicEvidenceError extends Error {}

export async function assertTopicsGrounded(opts: {
  language: string;
  proposals: TopicProposal[];
  /** labels que ya usan otros journeys del mismo idioma, para comparar */
  existingLabels?: string[];
  /**
   * MODO JOURNEY-LEVEL para corpus chicos (2026-09-06, aprobado por el usuario
   * via el chat de planificacion). Citas VERBATIM que sostienen el journey
   * ENTERO; los temas son los dominios de esas citas y no citan por separado.
   *
   * POR QUE. El modo por tema da por hecho que hay al menos una frase escrita
   * por tema, y en un idioma con poca demanda eso es falso: en portugues, de 9
   * solicitantes solo dos escribieron sobre su vida (Alison y Jean-Pierre); los
   * otros siete escribieron sobre la app. Con el modo por tema, siete temas
   * acaban citando dos frases repartidas, que es EXACTAMENTE el anti-patron del
   * Expat frances (seis temas citando la misma cadena "move abroad") solo que
   * escrito con frases de verdad. La diferencia que hace este modo es que la
   * escasez se DECLARA en vez de disimularse: las citas se declaran una vez, a
   * nivel de journey, y quedan impresas con cuanta gente hay detras.
   *
   * No abre la mano en nada mas: las citas siguen siendo verbatim, siguen
   * teniendo largo minimo, siguen sin contar los clics del desplegable, y las
   * reglas de nombre de los temas se comprueban igual.
   */
  journeyEvidence?: string[];
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
  /** Lo que escribio CADA persona, para poder contar personas y no frases. */
  const porPersona: string[][] = [];
  for (const r of rows) {
    // Antes del 2026-08-19, elegir "Other" guardaba el texto AQUÍ; desde
    // entonces vive en `learningGoal` y este campo es siempre el clic.
    // `learningGoal` dejó de preguntarse el 2026-08-23 (5 respuestas, dos con
    // dominio), así que de aquí en adelante el corpus lo sostiene
    // `applicationReason`, que es donde la gente cuenta su vida sin que se lo
    // pidan.
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
  const written = writtenMotivations.concat(reasons);
  const corpus = written.map(norm);

  if (corpus.length === 0) {
    throw new TopicEvidenceError(
      `Cero frases escritas de ${opts.language} en BetaSignup: ${rows.length} solicitudes, ` +
      `${cannedClicks} motivaciones son clics del desplegable y ninguna dice de qué habla la ` +
      `persona. Sin datos no se eligen temas.`,
    );
  }

  // ── Modo journey-level ──────────────────────────────────────
  //
  // El UMBRAL, comentado como se pidio: este modo es para idiomas con menos
  // frases de PROPOSITO que temas tiene el journey, o sea menos de 7. En
  // portugues, a 2026-09-06, son 2 (Alison y Jean-Pierre). Que una frase sea
  // "de proposito" y no opinion sobre la app no lo puede decidir el codigo:
  // "Curious about the new app" pasa cualquier medida de largo y no sostiene
  // ningun tema. Esa lectura es humana y va en el plan del journey.
  //
  // Lo que SI comprueba la maquina, para que el modo no sea una puerta de
  // atras: dos citas como minimo, de dos personas distintas como minimo, cada
  // una verbatim y con el largo minimo de siempre. Y se niega a activarse si
  // hay tantas citas declaradas como temas, porque entonces el corpus da para
  // citar tema por tema y este modo no pinta nada.
  const MIN_JOURNEY_QUOTES = 2;
  const MIN_JOURNEY_PEOPLE = 2;
  const modoJourney = Boolean(opts.journeyEvidence?.length);
  const problemasJourney: string[] = [];
  let personasDetras = 0;
  if (modoJourney) {
    const citas = opts.journeyEvidence!;
    if (citas.length < MIN_JOURNEY_QUOTES)
      problemasJourney.push(`el modo journey-level pide ${MIN_JOURNEY_QUOTES} citas como minimo y hay ${citas.length}`);
    if (citas.length >= opts.proposals.length)
      problemasJourney.push(
        `hay ${citas.length} citas para ${opts.proposals.length} temas: con eso se cita tema por tema, ` +
        `que es mas fuerte. El modo journey-level es para cuando NO alcanza.`,
      );
    const cortas = citas.filter((q) => quoteTooShort(q));
    if (cortas.length)
      problemasJourney.push(
        `citas demasiado cortas (minimo ${MIN_QUOTE_WORDS} palabras y ${MIN_QUOTE_CHARS} caracteres): ${cortas.join(" / ")}`,
      );
    const inventadas = citas.filter((q) => !quoteTooShort(q)).filter((q) => !corpus.some((c) => c.includes(norm(q))));
    if (inventadas.length) problemasJourney.push(`citas que nadie escribio en BetaSignup: ${inventadas.join(" / ")}`);
    personasDetras = porPersona.filter((ps) =>
      citas.some((q) => !quoteTooShort(q) && ps.some((p) => p.includes(norm(q)))),
    ).length;
    if (personasDetras < MIN_JOURNEY_PEOPLE)
      problemasJourney.push(
        `las citas son de ${personasDetras} persona(s) y hacen falta ${MIN_JOURNEY_PEOPLE}: ` +
        `una sola persona no decide siete temas.`,
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

  const bad = nameProblems.concat(problemasJourney).concat(modoJourney ? [] : opts.proposals.flatMap((p) => {
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
    `(${writtenMotivations.length} escritas a mano + ${reasons.length} applicationReason; ` +
    `${cannedClicks} clics del desplegable descartados)`,
  );
  if (modoJourney) {
    // La escasez, dicha en voz alta: una cabecera con las citas del journey y
    // cuanta gente hay detras, y debajo los temas como lo que son, dominios de
    // esas citas. Que se vea el numero es medio motivo de que exista el modo.
    console.log(`  MODO JOURNEY-LEVEL · ${personasDetras} persona(s) detras de todo el journey`);
    for (const q of opts.journeyEvidence!) console.log(`    <- ${q}`);
    console.log("");
    for (const p of opts.proposals) console.log(`  ${p.label.padEnd(30)} dominio`);
  } else {
    for (const p of opts.proposals) {
      const n = (p.evidence ?? [])
        .filter((q) => !quoteTooShort(q))
        .reduce((acc, q) => acc + corpus.filter((c) => c.includes(norm(q))).length, 0);
      console.log(`  ${p.label.padEnd(30)} ${String(n).padStart(3)} solicitantes  <- ${(p.evidence ?? []).join(" / ")}`);
    }
  }
  if (opts.existingLabels?.length) {
    console.log(`\n  Ya cubierto en ${opts.language}: ${opts.existingLabels.join(" · ")}`);
  }
  console.log("");

  if (bad.length) {
    throw new TopicEvidenceError(
      `TEMAS SIN RESPALDO:\n  - ${bad.join("\n  - ")}\n\n` +
      `Hay ${writtenMotivations.length} frases escritas a mano y ${reasons.length} applicationReason ` +
      `de ${opts.language} (${cannedClicks} clics del desplegable no cuentan). ` +
      `Corre \`npx tsx scripts/userEvidence.ts ${opts.language}\` y elige desde ahí.`,
    );
  }
}
