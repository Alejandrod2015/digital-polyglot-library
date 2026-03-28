import { assessStoryVocabQuality } from "@/lib/storyVocabQuality";
import {
  computeDynamicVocabRange,
  computeSoftMinimum,
  validateAndNormalizeVocab,
  wordCount,
  type VocabItem,
} from "@/lib/vocabValidation";
import {
  getStudioJourneyStory,
  type StudioJourneyStory,
} from "@/lib/studioJourneyStories";
import type { QAAgentFinding } from "@/agents/qa/types";
import { getRuleForLevel } from "@/agents/config/pedagogicalConfig";
import { chatCompletion, extractJSON, getProvider } from "@/agents/config/llmProvider";

type ParsedVocab = {
  items: VocabItem[];
  parseError: string | null;
};

type LLMQualityCheckResult = {
  narrativeQuality: number;
  cefrCompliance: number;
  languageNaturalness: number;
  topicRelevance: number;
  culturalAuthenticity: number;
  overallScore: number;
  findings: QAAgentFinding[];
};

export async function loadJourneyStoryForQa(storyId: string): Promise<StudioJourneyStory> {
  const story = await getStudioJourneyStory(storyId);
  if (!story) {
    throw new Error("Story not found.");
  }
  return story;
}

export function parseStoryVocab(raw: string): ParsedVocab {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { items: [], parseError: null };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { items: [], parseError: "Vocabulary must be a JSON array." };
    }
    return { items: parsed as VocabItem[], parseError: null };
  } catch {
    return { items: [], parseError: "Vocabulary could not be parsed as JSON." };
  }
}

export async function runStoryQaChecks(story: StudioJourneyStory): Promise<QAAgentFinding[]> {
  const findings: QAAgentFinding[] = [];

  if (!story.title.trim()) {
    findings.push({
      code: "missing_title",
      severity: "critical",
      field: "title",
      title: "Falta el título",
      message: "La historia no tiene título.",
      suggestion: "Añade un título claro antes de aprobarla.",
    });
  }

  if (!story.slug.trim()) {
    findings.push({
      code: "missing_slug",
      severity: "critical",
      field: "slug",
      title: "Falta el slug",
      message: "La historia no tiene slug.",
      suggestion: "Crea un slug limpio para poder publicarla y abrirla en la app.",
    });
  }

  if (!story.text.trim()) {
    findings.push({
      code: "missing_text",
      severity: "critical",
      field: "text",
      title: "Falta el texto",
      message: "La historia no tiene texto principal.",
      suggestion: "Genera o pega el texto completo de la historia.",
    });
    return findings;
  }

  const totalWords = wordCount(story.text);
  const cefrRule = getRuleForLevel(story.cefrLevel);

  if (cefrRule) {
    // CEFR-level-aware word count validation
    if (totalWords < cefrRule.wordCountRange.min) {
      findings.push({
        code: "story_too_short_for_level",
        severity: "warning",
        field: "text",
        title: `Historia corta para nivel ${story.cefrLevel.toUpperCase()}`,
        message: `La historia tiene ${totalWords} palabras pero el nivel ${story.cefrLevel.toUpperCase()} requiere al menos ${cefrRule.wordCountRange.min}.`,
        suggestion: `Amplía la narrativa hasta ${cefrRule.wordCountRange.min}-${cefrRule.wordCountRange.max} palabras para este nivel.`,
      });
    } else if (totalWords > cefrRule.wordCountRange.max * 1.3) {
      // Allow 30% margin before flagging as too long
      findings.push({
        code: "story_too_long_for_level",
        severity: "info",
        field: "text",
        title: `Historia larga para nivel ${story.cefrLevel.toUpperCase()}`,
        message: `La historia tiene ${totalWords} palabras. El rango recomendado para ${story.cefrLevel.toUpperCase()} es ${cefrRule.wordCountRange.min}-${cefrRule.wordCountRange.max}.`,
        suggestion: "Considera recortar para mantener la historia enfocada y accesible para el nivel.",
      });
    }
  } else if (totalWords < 120) {
    // Fallback if CEFR level is unknown
    findings.push({
      code: "story_too_short",
      severity: "warning",
      field: "text",
      title: "Historia demasiado corta",
      message: `La historia solo tiene ${totalWords} palabras.`,
      suggestion: "Amplía un poco la narrativa para que tenga suficiente valor pedagógico.",
    });
  }

  // CEFR-level-aware vocabulary density check
  if (cefrRule) {
    const parsedVocabForDensity = parseStoryVocab(story.vocabRaw);
    if (!parsedVocabForDensity.parseError && parsedVocabForDensity.items.length > 0) {
      if (parsedVocabForDensity.items.length < cefrRule.vocabDensity.minItems) {
        findings.push({
          code: "vocab_below_cefr_minimum",
          severity: "warning",
          field: "vocab",
          title: `Vocabulario insuficiente para ${story.cefrLevel.toUpperCase()}`,
          message: `Hay ${parsedVocabForDensity.items.length} items de vocabulario pero el nivel ${story.cefrLevel.toUpperCase()} recomienda al menos ${cefrRule.vocabDensity.minItems}.`,
          suggestion: `Añade más palabras clave hasta alcanzar ${cefrRule.vocabDensity.minItems}-${cefrRule.vocabDensity.maxItems} items.`,
        });
      } else if (parsedVocabForDensity.items.length > cefrRule.vocabDensity.maxItems * 1.5) {
        findings.push({
          code: "vocab_above_cefr_maximum",
          severity: "info",
          field: "vocab",
          title: `Demasiado vocabulario para ${story.cefrLevel.toUpperCase()}`,
          message: `Hay ${parsedVocabForDensity.items.length} items pero el máximo recomendado para ${story.cefrLevel.toUpperCase()} es ${cefrRule.vocabDensity.maxItems}.`,
          suggestion: "Reduce el vocabulario seleccionando solo las palabras más relevantes para el nivel.",
        });
      }
    }
  }

  if (!story.synopsis.trim()) {
    findings.push({
      code: "missing_synopsis",
      severity: "info",
      field: "synopsis",
      title: "Falta la sinopsis",
      message: "La historia no tiene sinopsis.",
      suggestion: "Añade una sinopsis breve para facilitar revisión y discovery.",
    });
  }

  if (!story.coverUrl.trim()) {
    findings.push({
      code: "missing_cover_url",
      severity: "info",
      field: "cover",
      title: "Falta la cover",
      message: "No hay una URL pública de cover.",
      suggestion: "Genera o sube una cover antes de publicar.",
    });
  }

  if (!story.audioUrl.trim()) {
    findings.push({
      code: "missing_audio_url",
      severity: "warning",
      field: "audio",
      title: "Falta el audio",
      message: "No hay una URL pública de audio.",
      suggestion: "Genera o sube el audio antes de publicar.",
    });
  }

  const vocabQuality = assessStoryVocabQuality(story.text, story.language);
  if (vocabQuality.status === "weak") {
    findings.push({
      code: "weak_vocab_quality",
      severity: "warning",
      field: "vocab",
      title: "Vocabulario poco reusable",
      message: vocabQuality.reason,
      suggestion: "Reescribe algunas frases para aumentar variedad léxica y expresiones útiles.",
    });
  }

  const parsedVocab = parseStoryVocab(story.vocabRaw);
  if (parsedVocab.parseError) {
    findings.push({
      code: "invalid_vocab_json",
      severity: "warning",
      field: "vocab",
      title: "Vocabulario mal formateado",
      message: parsedVocab.parseError,
      suggestion: "Guarda el vocabulario como JSON válido.",
    });
  } else if (parsedVocab.items.length === 0) {
    findings.push({
      code: "missing_vocab",
      severity: "warning",
      field: "vocab",
      title: "Falta el vocabulario",
      message: "La historia no tiene vocabulario útil cargado.",
      suggestion: "Genera y revisa el vocabulario antes de aprobar la historia.",
    });
  } else {
    const dynamicRange = computeDynamicVocabRange(story.text);
    const validation = validateAndNormalizeVocab({
      rawVocab: parsedVocab.items,
      text: story.text,
      language: story.language,
      level: story.cefrLevel,
      cefrLevel: story.cefrLevel,
    });

    if (validation.vocab.length < computeSoftMinimum(dynamicRange.minItems)) {
      findings.push({
        code: "vocab_too_small",
        severity: "warning",
        field: "vocab",
        title: "Poco vocabulario validado",
        message: `Solo quedaron ${validation.vocab.length} items válidos tras validar el vocabulario.`,
        suggestion: "Añade más palabras o mejora el texto para soportar más vocabulario.",
      });
    }

    if (validation.issues.length > 0) {
      findings.push({
        code: "vocab_validation_issues",
        severity: "info",
        field: "vocab",
        title: "Hay incidencias de vocabulario",
        message: `${validation.issues.length} items de vocabulario tienen incidencias.`,
        suggestion: "Revisa el bloque de vocabulario y corrige los items inválidos o débiles.",
      });
    }
  }

  // Validate CEFR level is recognized
  if (!cefrRule) {
    findings.push({
      code: "unknown_cefr_level",
      severity: "warning",
      field: "general",
      title: "Nivel CEFR no reconocido",
      message: `El nivel "${story.cefrLevel}" no se reconoce como un nivel CEFR válido (a1-c2).`,
      suggestion: "Asigna un nivel CEFR válido: a1, a2, b1, b2, c1 o c2.",
    });
  }

  // Check for missing or empty CEFR level
  if (!story.cefrLevel.trim()) {
    findings.push({
      code: "missing_cefr_level",
      severity: "critical",
      field: "general",
      title: "Falta el nivel CEFR",
      message: "La historia no tiene nivel CEFR asignado.",
      suggestion: "Asigna un nivel CEFR antes de publicar.",
    });
  }

  if (!story.journeyTopic.trim() || story.journeyOrder === null) {
    findings.push({
      code: "missing_journey_slot",
      severity: "critical",
      field: "journey",
      title: "Falta la ubicación en Journey",
      message: "La historia no tiene topic o slot del Journey completos.",
      suggestion: "Asigna el topic y el orden en Journey antes de usar esta historia en currículo.",
    });
  }

  // Run LLM quality checks if enabled and structural checks passed
  if (story.text.trim() && story.cefrLevel.trim()) {
    const llmResult = await runLLMQualityCheck({
      storyText: story.text,
      language: story.language,
      cefrLevel: story.cefrLevel,
      topic: story.journeyTopic || story.topic,
      synopsis: story.synopsis,
    });

    // Merge LLM findings with structural findings
    findings.push(...llmResult.findings);

    // Store the overall LLM score in a metadata object for later use in scoring
    // This will be used by the agent to compute the final score
    if (!(story as any)._llmQualityScore) {
      (story as any)._llmQualityScore = llmResult.overallScore;
    }
  }

  return findings;
}

// ── Draft QA: load a StoryDraft from Prisma and adapt to StudioJourneyStory shape ──
export async function loadDraftForQa(draftId: string): Promise<StudioJourneyStory> {
  const { prisma } = await import("@/lib/prisma");
  const draft = await (prisma as any).storyDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error(`Draft not found: ${draftId}`);

  const meta = (draft.metadata ?? {}) as Record<string, any>;
  const vocabRaw = draft.vocab ? JSON.stringify(draft.vocab) : "[]";

  // Adapt StoryDraft shape to StudioJourneyStory so QA checks work unchanged
  return {
    id: draft.id,
    documentId: draft.id,
    draftId: draft.id,
    hasDraft: true,
    hasPublished: false,
    title: draft.title ?? "",
    slug: draft.slug ?? "",
    synopsis: draft.synopsis ?? "",
    text: draft.text ?? "",
    vocabRaw,
    coverUrl: "",
    audioUrl: "",
    language: meta.language ?? "",
    variant: meta.variant ?? "",
    region: meta.variant ?? "",
    cefrLevel: meta.level ?? "",
    topic: meta.journeyTopic ?? "",
    languageFocus: "",
    journeyTopic: meta.journeyTopic ?? "",
    journeyOrder: meta.storySlot ?? null,
    journeyFocus: meta.journeyFocus ?? "",
    journeyEligible: true,
    published: false,
    storyVocabQualityRaw: "",
    vocabValidationRaw: "",
    audioQaStatus: "",
    audioQaScore: null,
    audioQaNotes: "",
    audioQaTranscript: "",
    audioQaCheckedAt: "",
    audioDeliveryQaStatus: "",
    audioDeliveryQaScore: null,
    audioDeliveryQaNotes: "",
    audioDeliveryQaCheckedAt: "",
    updatedAt: draft.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

// ── LLM-based narrative quality and CEFR compliance evaluation ──

export async function runLLMQualityCheck(params: {
  storyText: string;
  language: string;
  cefrLevel: string;
  topic: string;
  synopsis: string;
}): Promise<LLMQualityCheckResult> {
  // Check if LLM QA is enabled via environment variable
  const enableLLMQA = process.env.ENABLE_LLM_QA === "true";
  if (!enableLLMQA) {
    // Return a neutral result with no findings if disabled
    return {
      narrativeQuality: 7,
      cefrCompliance: 7,
      languageNaturalness: 7,
      topicRelevance: 7,
      culturalAuthenticity: 7,
      overallScore: 7,
      findings: [],
    };
  }

  const cefrRule = getRuleForLevel(params.cefrLevel);
  const wordCountInfo = cefrRule
    ? `${cefrRule.wordCountRange.min}-${cefrRule.wordCountRange.max} words`
    : "no specific range";

  const evaluationPrompt = `Você é um especialista em ensino de idiomas e garantia de qualidade para histórias educacionais. Avalie a qualidade narrativa e conformidade CEFR da seguinte história em ${params.language}.

## Contexto
- **Idioma**: ${params.language}
- **Nível CEFR**: ${params.cefrLevel.toUpperCase()}
- **Tópico**: ${params.topic}
- **Sinopse**: ${params.synopsis}
- **Intervalo de palavras esperado**: ${wordCountInfo}

## Texto da História
${params.storyText.slice(0, 4000)}

## Instruções de Avaliação

Avalie cada dimensão em uma escala de 0-10:

1. **Qualidade Narrativa** (0-10): A história é envolvente, bem estruturada com início, meio e fim claros? Há arco narrativo coerente? Os personagens são convincentes?

2. **Conformidade CEFR** (0-10): O vocabulário e a gramática correspondem ao nível CEFR declarado? A complexidade das frases é apropriada? Há uso excessivo de estruturas avançadas ou falta de estruturas esperadas?

3. **Naturalidade da Linguagem** (0-10): O texto lê-se como fala natural no idioma-alvo, não como tradução automática? Há fluxo natural e uso idiomático? As expressões soam autênticas?

4. **Relevância do Tópico** (0-10): O conteúdo se relaciona significativamente com o tópico declarado? A história mantém o foco no tema?

5. **Autenticidade Cultural** (0-10): A história reflete elementos culturais autênticos da região do idioma? Há sensibilidade cultural? Evita estereótipos?

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "narrativeQuality": <número 0-10>,
  "cefrCompliance": <número 0-10>,
  "languageNaturalness": <número 0-10>,
  "topicRelevance": <número 0-10>,
  "culturalAuthenticity": <número 0-10>,
  "reasoning": "Explicação concisa das notas"
}`;

  try {
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content:
            "Você é um especialista rigoroso em garantia de qualidade para histórias de aprendizado de idiomas. Sempre retorna JSON válido.",
        },
        { role: "user", content: evaluationPrompt },
      ],
      { temperature: 0.3, maxTokens: 1000 }
    );

    if (!raw) {
      throw new Error(`${getProvider()} returned no content`);
    }

    const result = extractJSON<Record<string, any>>(raw);

    const scores = {
      narrativeQuality: Math.max(0, Math.min(10, result.narrativeQuality ?? 7)),
      cefrCompliance: Math.max(0, Math.min(10, result.cefrCompliance ?? 7)),
      languageNaturalness: Math.max(0, Math.min(10, result.languageNaturalness ?? 7)),
      topicRelevance: Math.max(0, Math.min(10, result.topicRelevance ?? 7)),
      culturalAuthenticity: Math.max(0, Math.min(10, result.culturalAuthenticity ?? 7)),
    };

    // Calculate weighted overall score (equal weight for all dimensions)
    const overallScore = (
      scores.narrativeQuality +
      scores.cefrCompliance +
      scores.languageNaturalness +
      scores.topicRelevance +
      scores.culturalAuthenticity
    ) / 5;

    // Generate findings for dimensions below 7
    const findings: QAAgentFinding[] = [];

    if (scores.narrativeQuality < 7) {
      findings.push({
        code: "low_narrative_quality",
        severity: scores.narrativeQuality < 5 ? "critical" : "warning",
        field: "text",
        title: "Calidad narrativa baja",
        message: `La calidad narrativa puntúa ${scores.narrativeQuality}/10. La historia puede carecer de estructura clara, arco narrativo coherente, o personajes convincentes.`,
        suggestion:
          "Revisa la estructura narrativa: asegúrate de que haya un comienzo, desarrollo y conclusión claros. Desarrolla los personajes con mayor profundidad.",
      });
    }

    if (scores.cefrCompliance < 7) {
      findings.push({
        code: "low_cefr_compliance",
        severity: scores.cefrCompliance < 5 ? "critical" : "warning",
        field: "text",
        title: `Cumplimiento CEFR bajo para ${params.cefrLevel.toUpperCase()}`,
        message: `La conformidad CEFR puntúa ${scores.cefrCompliance}/10. El vocabulario o la gramática pueden no coincidir con el nivel ${params.cefrLevel.toUpperCase()} declarado.`,
        suggestion: `Ajusta el vocabulario y la complejidad gramatical para que coincidan con el nivel ${params.cefrLevel.toUpperCase()}. Revisa las estructuras gramaticales esperadas.`,
      });
    }

    if (scores.languageNaturalness < 7) {
      findings.push({
        code: "low_language_naturalness",
        severity: scores.languageNaturalness < 5 ? "critical" : "warning",
        field: "text",
        title: "Falta de naturalidad en el idioma",
        message: `La naturalidad del idioma puntúa ${scores.languageNaturalness}/10. El texto puede sonar como una traducción automática o carecer de fluidez natural.`,
        suggestion: "Reescribe secciones para que tengan un flujo más natural. Usa expresiones idiomáticas y un lenguaje más auténtico.",
      });
    }

    if (scores.topicRelevance < 7) {
      findings.push({
        code: "low_topic_relevance",
        severity: scores.topicRelevance < 5 ? "critical" : "warning",
        field: "text",
        title: "Baja relevancia del tema",
        message: `La relevancia del tema puntúa ${scores.topicRelevance}/10. El contenido puede no relacionarse significativamente con el tema declarado: "${params.topic}".`,
        suggestion: `Refuerza la conexión con el tema: "${params.topic}". Asegúrate de que la narrativa permanezca enfocada en el tema declarado.`,
      });
    }

    if (scores.culturalAuthenticity < 7) {
      findings.push({
        code: "low_cultural_authenticity",
        severity: scores.culturalAuthenticity < 5 ? "critical" : "warning",
        field: "text",
        title: "Baja autenticidad cultural",
        message: `La autenticidad cultural puntúa ${scores.culturalAuthenticity}/10. La historia puede carecer de elementos culturales auténticos o reflejar estereotipos.`,
        suggestion:
          "Enriquece la historia con elementos culturales auténticos de la región del idioma. Evita estereotipos y clichés culturales.",
      });
    }

    return {
      narrativeQuality: scores.narrativeQuality,
      cefrCompliance: scores.cefrCompliance,
      languageNaturalness: scores.languageNaturalness,
      topicRelevance: scores.topicRelevance,
      culturalAuthenticity: scores.culturalAuthenticity,
      overallScore,
      findings,
    };
  } catch (error) {
    // Graceful error handling: log the error and return neutral result
    console.error("Error during LLM quality check:", error);
    return {
      narrativeQuality: 7,
      cefrCompliance: 7,
      languageNaturalness: 7,
      topicRelevance: 7,
      culturalAuthenticity: 7,
      overallScore: 7,
      findings: [],
    };
  }
}
