// Source of truth for the asset-thesis progress UI at /studio/progreso.
// Update this file when a piece's status changes (and keep
// docs/asset-roadmap.md in sync for git-readable history).
//
// Strategy context lives in:
//   docs/asset-roadmap.md        (repo-visible)
//   ~/.claude/projects/.../memory/project_asset_thesis.md (Claude memory)

export type RoadmapStatus =
  | "not_started"
  | "in_progress"
  | "deployed"
  | "local_only"
  | "blocked";

export type RoadmapPiece = {
  title: string;
  status: RoadmapStatus;
  note?: string;
  commit?: string;
};

export type Movida = {
  id: number;
  title: string;
  subtitle: string;
  goal: string;
  startedAt?: string;
  completedAt?: string;
  pieces: RoadmapPiece[];
};

export type AssetCorpus = {
  id: "A" | "B" | "C";
  title: string;
  description: string;
  buyers: string;
};

export type WorkLogEntry = {
  date: string; // YYYY-MM-DD
  title: string;
  scope: string;
  summary: string;
  highlights: string[];
  commits?: string[];
};

export type AssetRoadmap = {
  lastUpdated: string;
  thesisHeadline: string;
  thesisSummary: string;
  assets: AssetCorpus[];
  wedge: string;
  whyNow: string;
  movidas: Movida[];
  workLog: WorkLogEntry[];
};

// Contribution to a movida's progress %, by piece status.
// deployed = 1.0 (fully done, live on main)
// local_only = 0.7 (work complete, awaiting deploy gate like DB migration)
// in_progress = 0.4 (started but not landed)
// not_started = 0
// blocked = 0
export function pieceWeight(status: RoadmapStatus): number {
  switch (status) {
    case "deployed":
      return 1.0;
    case "local_only":
      return 0.7;
    case "in_progress":
      return 0.4;
    case "not_started":
      return 0;
    case "blocked":
      return 0;
  }
}

export function movidaProgress(movida: Movida): number {
  if (movida.pieces.length === 0) return 0;
  const total = movida.pieces.reduce((sum, p) => sum + pieceWeight(p.status), 0);
  return total / movida.pieces.length;
}

export function statusLabel(status: RoadmapStatus): string {
  switch (status) {
    case "deployed":
      return "En producción";
    case "local_only":
      return "Local, sin push";
    case "in_progress":
      return "En progreso";
    case "not_started":
      return "Sin empezar";
    case "blocked":
      return "Bloqueado";
  }
}

export function statusColor(status: RoadmapStatus): { bg: string; fg: string } {
  switch (status) {
    case "deployed":
      return { bg: "rgba(16, 185, 129, 0.18)", fg: "#10b981" };
    case "local_only":
      return { bg: "rgba(251, 146, 60, 0.18)", fg: "#fb923c" };
    case "in_progress":
      return { bg: "rgba(245, 158, 11, 0.18)", fg: "#f59e0b" };
    case "not_started":
      return { bg: "rgba(156, 163, 175, 0.18)", fg: "#9ca3af" };
    case "blocked":
      return { bg: "rgba(239, 68, 68, 0.18)", fg: "#ef4444" };
  }
}

export const ASSET_ROADMAP: AssetRoadmap = {
  lastUpdated: "2026-05-07 (Movida 1 schema deployed)",
  thesisHeadline: "DPL como instrumento de captura de 3 corpora licenciables",
  thesisSummary:
    "La app B2C es la herramienta. El asset real son tres corpora estructurados que se pueden licenciar o vender por separado a labs de IA, plataformas de TTS y editoriales. Pre-launch = momento más barato para arquitecturar el data layer.",
  assets: [
    {
      id: "A",
      title: "Multimodal Reading-Listening-Comprehension Corpus",
      description:
        "Texto + audio alineado a nivel palabra (audioWordTimings) + eventos de comprensión por usuario + tags de dialecto/variant. La combinación es rara en el mercado.",
      buyers: "AI labs (Anthropic, OpenAI, Mistral, Cohere, Aleph Alpha)",
    },
    {
      id: "B",
      title: "AI Content-Generation Quality Corpus",
      description:
        "AgentRun + StoryDraft + QAReview + auditScore. Training data para 'cómo se hace buen contenido educativo, con QA estructurado'. Bottom-up, organicamente etiquetada.",
      buyers: "Labs de modelos educativos, editoriales (Pearson, Cornelsen, Klett)",
    },
    {
      id: "C",
      title: "Voice Diversity Library",
      description:
        "ClonedVoice + Modal/Piper + R2 cache + alineación palabra. Voces dialectales que ElevenLabs/Cartesia no cubren bien.",
      buyers: "TTS companies (ElevenLabs, Cartesia, Resemble, PlayHT)",
    },
  ],
  wedge:
    "Producto para aprender vocabulario en contexto con contenido diverso. La diferenciación está en la profundidad dialectal/regional del catálogo (disponible para cualquier learner), no en una demografía objetivo.",
  whyNow:
    "App pre-launch. Cada día sin tagging genera datos sin etiquetar. Retrofitting metadata cuando ya hay miles de usuarios cuesta 100x más.",
  movidas: [
    {
      id: 1,
      title: "Captura de datos del usuario",
      subtitle:
        "Cada interacción (clic, replay, abandono) se guarda etiquetada con dialecto y registro. Es la materia prima del corpus que después se vende.",
      goal:
        "Schema fields para tagging dialectal + 6 eventos nuevos de comprensión + wiring en ReaderScreen",
      startedAt: "2026-05-07",
      pieces: [
        {
          title: "Backend allowlist (6 reader events en /api/metrics y /api/mobile/metrics)",
          status: "deployed",
          commit: "a7d8392",
          note: "Acepta vocab_clicked, word_dwell, audio_segment_replay, story_abandoned, vocab_marked_known/unknown",
        },
        {
          title: "Mobile vocab_clicked wiring (karaoke + legacy paths)",
          status: "deployed",
          commit: "4d6416c",
          note: "En main; emite cuando próximo TestFlight build se cuta",
        },
        {
          title: "Schema fields en JourneyStory (register, generationCohort, culturalTags, voiceProvenance) + migration SQL",
          status: "deployed",
          note: "DB de producción ya tiene las 4 columnas (Neon). Vacías por defecto. Listas para tagear historias por dialecto/registro/cohorte/voiceProvenance",
        },
        {
          title: "Wiring de los otros 5 eventos (word_dwell, audio_segment_replay, story_abandoned, vocab_marked_known/unknown)",
          status: "not_started",
          note: "Cada uno tiene su trigger natural pendiente: long-press, seek-back, unmount, confidence UI",
        },
      ],
    },
    {
      id: 2,
      title: "Motor de repaso adaptativo",
      subtitle:
        "El sistema aprende qué palabras le cuestan a cada usuario y le programa repasos personalizados. Cuanto más se usa, mejor predice.",
      goal:
        "FSRS algorithm + endpoint de vocab para repasar + integración con practice + actualización de streak/nextReviewAt tras cada respuesta",
      startedAt: "2026-05-07",
      pieces: [
        {
          title: "FSRS-4.5 algorithm en src/lib/fsrs.ts (+ tests + adapter desde Favorite actual)",
          status: "deployed",
          note: "Algoritmo + reviewCard + favoriteToFsrsCard + compareByDueness. Tests en src/lib/__tests__/fsrs.test.ts. Sin callers todavía; las próximas piezas conectan",
        },
        {
          title: "Endpoint GET /api/practice/due (vocab para repasar hoy)",
          status: "deployed",
          note: "Web (/api/practice/due) y mobile (/api/mobile/practice/due). Query params: limit (default 20, max 100), language. Ordena por compareByDueness. Devuelve { items, total, dueCount }",
        },
        {
          title: "Integración con practice_session_started (cargar primero items SRS-due)",
          status: "deployed",
          note: "sortPracticeItemsByDueness en src/lib/practiceExercises.ts; aplicado en practice/page.tsx solo en modo default favoritos (no journey/story practice). Mobile shell pendiente",
        },
        {
          title: "Update de nextReviewAt y streak tras cada respuesta (server-side helper + endpoints)",
          status: "deployed",
          note: "applyReviewToFavorite en src/lib/practiceReview.ts orquesta FSRS + Prisma. Endpoints POST /api/practice/review (web) y POST /api/mobile/practice/review (mobile)",
        },
        {
          title: "Auto-grade silencioso desde practice flow (sin UX visible)",
          status: "deployed",
          note: "El botón Continue auto-deriva el grade desde correcto/incorrecto y llama POST /api/practice/review en background fire-and-forget. Cero cambio visual para el usuario. Asset crece invisible. Mobile pendiente del mismo wiring",
        },
      ],
    },
    {
      id: 3,
      title: "Posicionamiento de vocabulario en contexto",
      subtitle:
        "El producto y la marca dejan claro que el valor es leer y escuchar contenido diverso aprendiendo vocabulario en su contexto real. La profundidad dialectal del catálogo es la prueba, no el target.",
      goal:
        "Branding y copy para que el wedge de vocabulario-en-contexto con contenido diverso esté claro desde el launch",
      pieces: [
        {
          title: "Landing page con copy enfocado en vocabulario en contexto + contenido diverso",
          status: "not_started",
        },
        {
          title: "Onboarding: preferencia de dialecto/región para rutear contenido, sin asumir identidad",
          status: "not_started",
        },
        {
          title: "Pricing tier reflejando el valor de la profundidad del catálogo",
          status: "not_started",
        },
        {
          title: "Marketing surfaces dimensionadas para el público amplio de learners",
          status: "not_started",
        },
      ],
    },
  ],
  // Bitácora: chronological log de cada bloque de trabajo. Más reciente
  // arriba. Editar este array al cerrar cada commit/sesión para que la
  // página /studio/progreso refleje "qué hicimos cuándo y por qué".
  workLog: [
    {
      date: "2026-05-07",
      title: "Schema dialect/register aplicado en producción",
      scope: "Movida 1 (Captura de datos)",
      summary:
        "Las 4 columnas para tagear historias por dialecto, registro, cohorte y proveniencia de voz ya están en la DB de producción. Listas para usarse cuando quieras empezar a etiquetar historias.",
      highlights: [
        "Migration aplicada: 20260507000000_add_journey_story_dialect_metadata",
        "DB Neon: 4 columnas nuevas en dp_journey_stories_v1 (register TEXT[], generationCohort TEXT, culturalTags TEXT[], voiceProvenance JSONB)",
        "Default vacías; sin impacto en historias existentes",
        "Movida 1 cierra al 100% una vez los 5 eventos de comprensión restantes tengan UI trigger",
      ],
      commits: ["786a571"],
    },
    {
      date: "2026-05-07",
      title: "Fix: Vercel build desbloqueado tras merge del otro chat",
      scope: "Infra",
      summary:
        "Tras mergear la rama del otro chat (voice catalog + multi-voice Viajero) a main, Vercel falló por dos errores de tipos. Identificados y corregidos.",
      highlights: [
        "src/app/api/generate-vocab/route.ts: removido `export` del type y función (Next.js 15 prohíbe exports no-Route en route.ts)",
        "src/app/api/studio/audio/voices/route.ts: agregado `license: 'Unverified'` a ClonedVoice → VoiceEntry mapping (license ahora es required)",
        "Ambos errores invisibles en hot reload local; solo aparecen en `next build`",
      ],
      commits: ["af96f6b"],
    },
    {
      date: "2026-05-07",
      title: "Merge: voice catalog + Viajero LATAM stories + Studio rediseñado",
      scope: "Estudio (otro chat)",
      summary:
        "Fast-forward del trabajo del otro chat a main. Trae todo el rediseño del Studio: voice catalog 100% gratis con badges de licencia, gallery con 4 secciones, Studio Monitor con variant pill, 2 stories Viajero LATAM live.",
      highlights: [
        "Voice catalog: ES + LATAM + IT + BR completos. DE solo Bark Speaker 4. Todos Apache 2.0/MIT/CC0",
        "Gallery redesign con secciones por categoría + pills de región + license badges",
        "Topic rename: Food & Everyday Life → Food & Drink",
        "Spec: Viajero default multi-voz, vocab distribuido 3-5 por párrafo",
        "Stories en producción: Tinto en La Candelaria, Carnitas en Coyoacán",
      ],
      commits: ["bd06956", "a4696cf"],
    },
    {
      date: "2026-05-07",
      title: "Auto-grade silencioso en práctica (sin cambio de UX)",
      scope: "Movida 2 (SRS engine)",
      summary:
        "El motor SRS recibe señal de cada respuesta del usuario sin que él vea nada distinto. El botón Continue es el mismo de siempre pero ahora deriva el grade automáticamente y lo manda al server en background.",
      highlights: [
        "Continue button visualmente intacto",
        "Al click, deriva grade desde lastResult: correcto → 3 (Good), incorrecto → 1 (Again)",
        "Fire-and-forget POST /api/practice/review, errores no bloquean UX",
        "Asset crece invisible: cada respuesta de práctica alimenta FSRS",
        "Revertimos el cambio de los 4 botones visibles que era invasivo de la UX",
      ],
    },
    {
      date: "2026-05-07",
      title: "Bitácora del proyecto",
      scope: "Infra de visibilidad",
      summary:
        "Esta misma sección. Te permite ver cronológicamente todo lo hecho sin tener que leer git ni preguntarme.",
      highlights: [
        "Nuevo tipo WorkLogEntry en assetRoadmap.ts (data file)",
        "Sección 'Bitácora' al final de /studio/progreso renderizando estos entries",
        "Cada vez que avance algo, edito una línea acá y aparece en producción",
      ],
    },
    {
      date: "2026-05-07",
      title: "Movida 2 pieza 4: helper server-side + endpoints de review",
      scope: "Movida 2 (SRS engine)",
      summary:
        "Cuando un usuario califica una palabra (Again/Hard/Good/Easy), el server hace los cálculos FSRS y guarda el nuevo estado. Sin UI todavía, pero el backend está listo para que cualquier cliente lo llame.",
      highlights: [
        "applyReviewToFavorite() en src/lib/practiceReview.ts: lee favorito, corre FSRS, persiste",
        "POST /api/practice/review (web) y POST /api/mobile/practice/review (mobile)",
        "Body: { word, grade 1-4, language? } → response: { intervalDays, nextReviewAt, streak, card }",
      ],
      commits: ["55a8cd2"],
    },
    {
      date: "2026-05-07",
      title: "Movida 2 pieza 3: cola de práctica ordenada por SRS",
      scope: "Movida 2 (SRS engine)",
      summary:
        "Cuando el usuario abre /practice sin contexto de journey/story, las palabras vienen ordenadas por urgencia: primero las atrasadas o nuevas, después las programadas hacia el futuro.",
      highlights: [
        "sortPracticeItemsByDueness() en src/lib/practiceExercises.ts",
        "Aplicado en 3 paths del practice/page.tsx: live fetch, cache JSON, localStorage fallback",
        "Journey/story practice mantienen su orden curricular (intencional)",
      ],
      commits: ["30cc8eb"],
    },
    {
      date: "2026-05-07",
      title: "Movida 2 pieza 2: endpoint /api/practice/due",
      scope: "Movida 2 (SRS engine)",
      summary:
        "API que cualquier cliente puede llamar para preguntar 'qué palabras debería repasar este usuario ahora'. Web y mobile, mismo contrato.",
      highlights: [
        "GET /api/practice/due y /api/mobile/practice/due",
        "Query params: limit (default 20, max 100), language opcional",
        "Devuelve items ordenados por dueness + total + dueCount",
      ],
      commits: ["69869be"],
    },
    {
      date: "2026-05-07",
      title: "Movida 2 pieza 1: algoritmo FSRS-4.5 implementado",
      scope: "Movida 2 (SRS engine)",
      summary:
        "El motor que calcula 'cuándo debe repasar el usuario esta palabra' basado en cómo le fue históricamente. Mismo que usa Anki, refinado por la comunidad open-source.",
      highlights: [
        "src/lib/fsrs.ts (~190 líneas, sin dependencias externas)",
        "12 tests en src/lib/__tests__/fsrs.test.ts",
        "API: reviewCard(), newCard(), favoriteToFsrsCard() (adapter), compareByDueness()",
        "Adapter aproxima desde el schema actual hasta que migremos a columnas FSRS completas",
      ],
      commits: ["a501a42"],
    },
    {
      date: "2026-05-07",
      title: "Página /studio/progreso para visualizar el roadmap",
      scope: "Infra de visibilidad",
      summary:
        "Donde estás leyendo esto. Tarjetas de los 3 corpora, barras de progreso por movida, badges de status por pieza. Un solo lugar para ver cómo va todo.",
      highlights: [
        "Nueva sección 'ESTUDIO' en el sidebar del Studio admin",
        "Datos en src/lib/assetRoadmap.ts; espejo en docs/asset-roadmap.md",
        "Cálculo de progreso: deployed=100%, local_only=70%, in_progress=40%, not_started=0",
      ],
      commits: ["57fef97"],
    },
    {
      date: "2026-05-07",
      title: "Movida 1: data layer foundation",
      scope: "Movida 1 (Data layer)",
      summary:
        "La plomería que captura cada interacción del usuario como dato etiquetado para el corpus. Backend acepta los eventos, mobile emite el primero.",
      highlights: [
        "6 nuevos eventos en /api/metrics y /api/mobile/metrics: vocab_clicked, word_dwell, audio_segment_replay, story_abandoned, vocab_marked_known/unknown",
        "Mobile ReaderScreen emite vocab_clicked en karaoke + legacy paths",
        "Schema con 4 columnas nuevas en JourneyStory (register, generationCohort, culturalTags, voiceProvenance) PENDIENTE de aplicar migration",
      ],
      commits: ["a7d8392", "4d6416c"],
    },
    {
      date: "2026-05-07",
      title: "Asset roadmap doc en repo + memoria persistente",
      scope: "Estrategia",
      summary:
        "Documentamos la tesis del asset (3 corpora, comparables, exit math) en dos lugares: visible en el repo (docs/) y en la memoria de Claude para que persista entre sesiones.",
      highlights: [
        "docs/asset-roadmap.md con tesis + movidas + estado",
        "3 archivos de memoria: project_asset_thesis, project_movidas_roadmap, feedback_verify_vercel_deploy",
        "MEMORY.md indexado para que arranque cargada en cualquier futura sesión",
      ],
      commits: ["c7dbee9", "3e357f4"],
    },
    {
      date: "2026-05-07",
      title: "Fix: builds de Vercel desbloqueados",
      scope: "Infra",
      summary:
        "Tu commit 5f256da del 6 de mayo introdujo un import roto que bloqueaba TODOS los builds de Vercel desde entonces. Restauramos la función que faltaba.",
      highlights: [
        "src/lib/objectStorage.ts: getPublicObjectUrl() restaurada (vivía en otra branch sin mergear)",
        "Builds de Vercel volvieron a pasar y propagaron a producción todos los cambios pendientes",
      ],
      commits: ["cd2c410"],
    },
    {
      date: "2026-05-07",
      title: "Páginas legales en alemán + bilingual toggle",
      scope: "Legal",
      summary:
        "Versión DE de Privacy, Impressum, Cookies, Términos y Data Deletion. Cada página tiene un link para alternar entre idiomas. Importante porque operás desde Hamburg y serás revisado por App Store en alemán.",
      highlights: [
        "5 páginas nuevas en /<ruta>/de con terminología legal alemana formal (Sie-form)",
        "Toggle 'Auf Deutsch lesen' / 'Read in English' en cada par",
        "Cláusula de precedencia: para usuarios en Alemania prevalece la versión alemana",
      ],
      commits: ["39bd017", "73baae5"],
    },
    {
      date: "2026-05-07",
      title: "Privacy Policy reescrita para habilitar la tesis del asset",
      scope: "Legal",
      summary:
        "Tu Privacy original cerraba la puerta a vender el corpus. La reescribimos para autorizar uso agregado/anonimizado en ML, partnerships y exit, sin perder protección al usuario.",
      highlights: [
        "Lista completa de 10 procesadores (incluyendo OpenAI, Anthropic, ElevenLabs, Sanity, Modal)",
        "Cláusula de Business Transfers (M&A) agregada",
        "Tabla de retención por categoría (incluyendo §147 AO 10 años para registros fiscales)",
        "Hamburgische Beauftragte für Datenschutz nombrada como autoridad",
        "'We do not sell identifiable personal data' (vs 'no sell ANY data') desbloquea licencia anonimizada",
      ],
      commits: ["673cb08", "328c33e"],
    },
  ],
};
