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

export type AssetRoadmap = {
  lastUpdated: string;
  thesisHeadline: string;
  thesisSummary: string;
  assets: AssetCorpus[];
  wedge: string;
  whyNow: string;
  movidas: Movida[];
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
  lastUpdated: "2026-05-07 (Movida 2 piece 2)",
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
    "Heritage learners: 60M+ US Hispanos + diáspora italiana/alemana/polaca/coreana/vietnamita. Quieren el dialecto de su familia, no Madrid genérico. Pagan 3-5x más que aprendices funcionales.",
  whyNow:
    "App pre-launch. Cada día sin tagging genera datos sin etiquetar. Retrofitting metadata cuando ya hay miles de usuarios cuesta 100x más.",
  movidas: [
    {
      id: 1,
      title: "Data layer foundation",
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
          status: "local_only",
          note: "Aplicar migration a DB de producción ANTES de pushear; si no, queries 500",
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
      title: "SRS engine sobre Favorite",
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
          status: "not_started",
        },
        {
          title: "Update de nextReviewAt y streak tras cada respuesta (PATCH /api/favorites + grade del usuario)",
          status: "not_started",
          note: "PATCH endpoint ya existe; falta UI de grade + llamarlo con valores que vengan de FSRS reviewCard()",
        },
      ],
    },
    {
      id: 3,
      title: "Day-1 dialect/heritage positioning",
      goal:
        "Branding y copy para que el wedge de heritage learners esté claro desde el launch",
      pieces: [
        {
          title: "Landing page con copy de dialecto/heritage (no genérico)",
          status: "not_started",
        },
        {
          title: "Onboarding: pregunta sobre heritage/región/familia, ruta a contenido del dialecto correspondiente",
          status: "not_started",
        },
        {
          title: "Pricing tier reflejando posicionamiento premium ($20-30/mo)",
          status: "not_started",
        },
        {
          title: "Marketing surface para segmento heritage (TikTok hispano-gringo, IG)",
          status: "not_started",
        },
      ],
    },
  ],
};
