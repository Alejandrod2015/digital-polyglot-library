/**
 * Cálculo de la sección "Aprendizaje" del dashboard de métricas.
 *
 * Vive fuera del route handler por dos razones. La primera es que se
 * puede correr contra la base sin una sesión de Clerk delante, que es lo
 * que hace `scripts/_verifyLearningMetrics.ts`; la segunda es que el
 * route ya pasa de las dos mil líneas y esto es aritmética pura sin una
 * sola consulta dentro.
 *
 * Solo hay dos señales, y son las dos que la app emite de verdad:
 * sesiones de práctica (con su precisión) y consultas de vocabulario. El
 * progreso por tema de journey NO está aquí a propósito:
 * `journey_topic_checkpoint_complete` no tiene ni una fila y
 * `journey_story_read` se quedó en cinco filas de mayo de 2026 porque
 * solo lo dispara el web. Un panel a cero se lee como "nadie practica"
 * cuando lo que dice en realidad es "nadie mide".
 */

export type LearningPracticeRow = {
  userId: string;
  storySlug: string;
  eventType: string;
  metadata?: unknown;
};

export type LearningVocabRow = {
  userId: string;
  storySlug: string;
  metadata?: unknown;
};

export type LearningMetrics = {
  practice: {
    started: number;
    completed: number;
    completionRate: number;
    avgAccuracyPercent: number;
    practicingUsers: number;
    byMode: Array<{
      mode: string;
      started: number;
      completed: number;
      completionRate: number;
      avgAccuracyPercent: number;
    }>;
    accuracyDistribution: Array<{ bucket: string; sessions: number }>;
  };
  vocab: {
    lookups: number;
    uniqueWords: number;
    lookingUpUsers: number;
    lookupsPerReader: number;
    topWords: Array<{
      word: string;
      language: string | null;
      wordType: string | null;
      lookups: number;
      users: number;
    }>;
    bySource: Array<{ source: string; lookups: number }>;
  };
  byLanguage: Array<{
    language: string;
    lookups: number;
    practiceCompleted: number;
    avgAccuracyPercent: number;
    users: number;
  }>;
  byLevel: Array<{
    level: string;
    practiceStarted: number;
    practiceCompleted: number;
    avgAccuracyPercent: number;
    users: number;
  }>;
  /**
   * Sesiones que no se pudieron atribuir a ningún nivel, y por qué. La
   * tabla por nivel las descarta, y descartarlas en silencio hace que
   * sus totales no cuadren con los de arriba sin que se vea el motivo.
   * `placeholder` son las sesiones que la app registra con el slug
   * "practice" porque ningún ejercicio traía historia; `unknownStory`
   * es todo lo demás (historias sin CEFR declarado en ninguna tabla, o
   * que ya no existen).
   */
  levelUnattributed: {
    sessions: number;
    placeholder: number;
    unknownStory: number;
  };
};

export const TOP_VOCAB_WORDS_LIMIT = 25;

const ACCURACY_BUCKETS: Array<{ bucket: string; min: number; max: number }> = [
  { bucket: "0-59%", min: 0, max: 59 },
  { bucket: "60-79%", min: 60, max: 79 },
  { bucket: "80-99%", min: 80, max: 99 },
  { bucket: "100%", min: 100, max: 100 },
];

export function emptyLearningMetrics(): LearningMetrics {
  return {
    practice: {
      started: 0,
      completed: 0,
      completionRate: 0,
      avgAccuracyPercent: 0,
      practicingUsers: 0,
      byMode: [],
      accuracyDistribution: [],
    },
    vocab: {
      lookups: 0,
      uniqueWords: 0,
      lookingUpUsers: 0,
      lookupsPerReader: 0,
      topWords: [],
      bySource: [],
    },
    byLanguage: [],
    byLevel: [],
    levelUnattributed: { sessions: 0, placeholder: 0, unknownStory: 0 },
  };
}

function readMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function readStr(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function readAccuracy(meta: Record<string, unknown>): number | null {
  const acc = meta.accuracyPercent;
  if (typeof acc !== "number" || !Number.isFinite(acc)) return null;
  return Math.max(0, Math.min(100, acc));
}

function avgOf(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Tasa en porcentaje, con tope en 100. El tope no es cosmético: una
 * sesión que empieza antes del rango y termina dentro cuenta su final
 * aquí y su principio no, así que `listening` llegó a marcar 133% de
 * finalización con 3 iniciadas y 4 completadas. Por encima de 100 el
 * número deja de significar nada, y el desajuste es del recorte de
 * fechas, no del usuario.
 */
function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

export function computeLearningMetrics({
  practiceRows,
  vocabRows,
  languageMap,
  levelMap,
  normalizeLanguage,
}: {
  practiceRows: LearningPracticeRow[];
  vocabRows: LearningVocabRow[];
  /** storySlug -> código de idioma ya normalizado (es / de / pt...). */
  languageMap: Map<string, string>;
  /** storySlug -> nivel CEFR en minúsculas (a0, a1, c1...). */
  levelMap: Map<string, string>;
  normalizeLanguage: (raw: string) => string;
}): LearningMetrics {
  // El idioma se resuelve por slug además de por metadata: el móvil manda
  // `language: null` en las sesiones de práctica y solo lo rellena en
  // `vocab_clicked`, así que sin el mapa la tabla por idioma tendría las
  // consultas de vocabulario y ninguna práctica.
  const languageOf = (
    meta: Record<string, unknown>,
    slug: string
  ): string | null => {
    const declared = readStr(meta, "language");
    if (declared) return normalizeLanguage(declared);
    return languageMap.get(slug) ?? null;
  };

  const practiceStarted = practiceRows.filter(
    (r) => r.eventType === "practice_session_started"
  );
  const practiceCompleted = practiceRows.filter(
    (r) => r.eventType === "practice_session_completed"
  );

  // La precisión solo cuenta sobre sesiones terminadas: una sesión
  // abandonada guarda el `accuracyPercent` que llevara en ese momento, y
  // promediarlo con las completas hunde el número sin que nadie haya
  // fallado nada.
  const accuracyValues: number[] = [];
  for (const row of practiceCompleted) {
    const acc = readAccuracy(readMeta(row.metadata));
    if (acc !== null) accuracyValues.push(acc);
  }

  const modeAgg = new Map<
    string,
    { started: number; completed: number; accuracies: number[] }
  >();
  for (const row of practiceRows) {
    const meta = readMeta(row.metadata);
    const mode = readStr(meta, "mode") ?? "mixed";
    const entry = modeAgg.get(mode) ?? {
      started: 0,
      completed: 0,
      accuracies: [] as number[],
    };
    if (row.eventType === "practice_session_started") {
      entry.started += 1;
    } else {
      entry.completed += 1;
      const acc = readAccuracy(meta);
      if (acc !== null) entry.accuracies.push(acc);
    }
    modeAgg.set(mode, entry);
  }

  const wordAgg = new Map<
    string,
    {
      word: string;
      language: string | null;
      wordType: string | null;
      lookups: number;
      users: Set<string>;
    }
  >();
  const vocabSourceAgg = new Map<string, number>();
  const vocabUsers = new Set<string>();
  for (const row of vocabRows) {
    const meta = readMeta(row.metadata);
    vocabUsers.add(row.userId);
    const source = readStr(meta, "source") ?? "sin marcar";
    vocabSourceAgg.set(source, (vocabSourceAgg.get(source) ?? 0) + 1);
    const word = readStr(meta, "word");
    if (!word) continue;
    const language = languageOf(meta, row.storySlug);
    // La clave lleva el idioma porque "la" existe en tres de los nuestros
    // y sumarlas juntas inventaría una palabra estrella.
    const key = `${language ?? "?"}::${word.toLowerCase()}`;
    const entry = wordAgg.get(key) ?? {
      word,
      language,
      wordType: readStr(meta, "wordType"),
      lookups: 0,
      users: new Set<string>(),
    };
    entry.lookups += 1;
    entry.users.add(row.userId);
    if (!entry.wordType) entry.wordType = readStr(meta, "wordType");
    wordAgg.set(key, entry);
  }

  const emptyLangEntry = () => ({
    lookups: 0,
    practiceCompleted: 0,
    accuracies: [] as number[],
    users: new Set<string>(),
  });
  const languageAgg = new Map<string, ReturnType<typeof emptyLangEntry>>();
  for (const row of vocabRows) {
    const lang = languageOf(readMeta(row.metadata), row.storySlug);
    if (!lang) continue;
    const entry = languageAgg.get(lang) ?? emptyLangEntry();
    entry.lookups += 1;
    entry.users.add(row.userId);
    languageAgg.set(lang, entry);
  }
  for (const row of practiceCompleted) {
    const meta = readMeta(row.metadata);
    const lang = languageOf(meta, row.storySlug);
    if (!lang) continue;
    const entry = languageAgg.get(lang) ?? emptyLangEntry();
    entry.practiceCompleted += 1;
    entry.users.add(row.userId);
    const acc = readAccuracy(meta);
    if (acc !== null) entry.accuracies.push(acc);
    languageAgg.set(lang, entry);
  }

  const levelAgg = new Map<
    string,
    { started: number; completed: number; accuracies: number[]; users: Set<string> }
  >();
  let placeholderSessions = 0;
  let unknownStorySessions = 0;
  for (const row of practiceRows) {
    const level = levelMap.get(row.storySlug);
    if (!level) {
      // "practice" es el slug de reserva que pone `trackPracticeMetric`
      // cuando ningún ejercicio de la tanda traía historia asociada. No
      // es una historia que falte, es una sesión sin historia.
      if (row.storySlug === "practice") placeholderSessions += 1;
      else unknownStorySessions += 1;
      continue;
    }
    const entry = levelAgg.get(level) ?? {
      started: 0,
      completed: 0,
      accuracies: [] as number[],
      users: new Set<string>(),
    };
    entry.users.add(row.userId);
    if (row.eventType === "practice_session_started") {
      entry.started += 1;
    } else {
      entry.completed += 1;
      const acc = readAccuracy(readMeta(row.metadata));
      if (acc !== null) entry.accuracies.push(acc);
    }
    levelAgg.set(level, entry);
  }

  return {
    practice: {
      started: practiceStarted.length,
      completed: practiceCompleted.length,
      completionRate: pct(practiceCompleted.length, practiceStarted.length),
      avgAccuracyPercent: avgOf(accuracyValues),
      practicingUsers: new Set(practiceRows.map((r) => r.userId)).size,
      byMode: Array.from(modeAgg.entries())
        .map(([mode, v]) => ({
          mode,
          started: v.started,
          completed: v.completed,
          completionRate: pct(v.completed, v.started),
          avgAccuracyPercent: avgOf(v.accuracies),
        }))
        .sort((a, b) => b.started + b.completed - (a.started + a.completed)),
      accuracyDistribution: ACCURACY_BUCKETS.map((b) => ({
        bucket: b.bucket,
        sessions: accuracyValues.filter((v) => v >= b.min && v <= b.max).length,
      })),
    },
    vocab: {
      lookups: vocabRows.length,
      uniqueWords: wordAgg.size,
      lookingUpUsers: vocabUsers.size,
      lookupsPerReader:
        vocabUsers.size > 0
          ? Math.round((vocabRows.length / vocabUsers.size) * 10) / 10
          : 0,
      topWords: Array.from(wordAgg.values())
        .map((v) => ({
          word: v.word,
          language: v.language,
          wordType: v.wordType,
          lookups: v.lookups,
          users: v.users.size,
        }))
        .sort((a, b) => b.lookups - a.lookups || b.users - a.users)
        .slice(0, TOP_VOCAB_WORDS_LIMIT),
      bySource: Array.from(vocabSourceAgg.entries())
        .map(([source, lookups]) => ({ source, lookups }))
        .sort((a, b) => b.lookups - a.lookups),
    },
    byLanguage: Array.from(languageAgg.entries())
      .map(([language, v]) => ({
        language,
        lookups: v.lookups,
        practiceCompleted: v.practiceCompleted,
        avgAccuracyPercent: avgOf(v.accuracies),
        users: v.users.size,
      }))
      .sort(
        (a, b) =>
          b.lookups + b.practiceCompleted - (a.lookups + a.practiceCompleted)
      ),
    byLevel: Array.from(levelAgg.entries())
      .map(([level, v]) => ({
        level,
        practiceStarted: v.started,
        practiceCompleted: v.completed,
        avgAccuracyPercent: avgOf(v.accuracies),
        users: v.users.size,
      }))
      .sort((a, b) => a.level.localeCompare(b.level)),
    levelUnattributed: {
      sessions: placeholderSessions + unknownStorySessions,
      placeholder: placeholderSessions,
      unknownStory: unknownStorySessions,
    },
  };
}
