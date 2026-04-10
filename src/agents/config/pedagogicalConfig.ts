/**
 * Pedagogical Configuration for Digital Polyglot Library
 *
 * Defines CEFR-level rules that AI agents use to generate and validate
 * language learning stories. Grammar structures are described in English
 * to be language-agnostic across all supported languages.
 */

export type CEFRLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

export type PedagogicalRule = {
  level: CEFRLevel;
  label: string;
  wordCountRange: { min: number; max: number };
  sentenceComplexity: "simple" | "compound" | "complex" | "advanced";
  grammarStructures: string[];
  vocabDensity: { minItems: number; maxItems: number };
  vocabType: string;
  toneGuidance: string;
  exampleTopics: string[];
};

export const PEDAGOGICAL_RULES: Record<CEFRLevel, PedagogicalRule> = {
  a1: {
    level: "a1",
    label: "Beginner",
    wordCountRange: { min: 250, max: 350 },
    sentenceComplexity: "simple",
    grammarStructures: [
      "Present simple tense (to be, to have, common verbs)",
      "Basic subject-verb-object word order",
      "Present tense of regular verbs (present simple)",
      "Common irregular verbs (to be, to have, to go)",
      "Definite and indefinite articles",
      "Basic adjectives (color, size, quality)",
      "Personal pronouns (I, you, he, she, it, we, they)",
      "Simple interrogative forms (yes/no questions)",
      "Common prepositions (in, on, at, under, near)",
      "Numbers and counting",
      "Basic possessive forms",
      "Common imperative forms",
      "Negative forms with simple negation",
    ],
    vocabDensity: { minItems: 15, maxItems: 22 },
    vocabType: "concrete",
    toneGuidance:
      "Friendly and encouraging. Use repetition of key phrases and vocabulary. Keep paragraphs very short (1-2 sentences). Use present tense predominantly.",
    exampleTopics: [
      "greetings and introductions",
      "family members",
      "basic food and drink",
      "colors and shapes",
      "daily routine",
      "numbers and telling time",
      "basic locations",
      "common animals",
    ],
  },

  a2: {
    level: "a2",
    label: "Elementary",
    wordCountRange: { min: 300, max: 450 },
    sentenceComplexity: "compound",
    grammarStructures: [
      "Present simple tense (all regular and common irregular verbs)",
      "Past simple tense (regular and common irregular verbs)",
      "Present continuous/progressive forms",
      "Immediate future using present continuous (going to/near future)",
      "Basic conditional forms (would, should)",
      "Comparative adjectives (more/less adjectives, -er forms)",
      "Superlative adjectives",
      "Basic interrogative with where, when, why, how",
      "Possessive adjectives and pronouns",
      "Reflexive pronouns in basic contexts",
      "Simple connectors (and, but, because, so)",
      "Prepositions of place and time",
      "Modal verbs for ability (can, could)",
      "There is/there are constructions",
      "Object and subject pronouns",
    ],
    vocabDensity: { minItems: 12, maxItems: 20 },
    vocabType: "concrete",
    toneGuidance:
      "Clear narrative voice. Include short dialogues between characters. Use a mix of present and past tense. Simple but engaging descriptions.",
    exampleTopics: [
      "travel basics and directions",
      "shopping and prices",
      "weather and seasons",
      "hobbies and leisure activities",
      "describing neighborhoods and places",
      "basic social interactions",
      "simple past events",
      "likes and dislikes",
    ],
  },

  b1: {
    level: "b1",
    label: "Intermediate",
    wordCountRange: { min: 400, max: 700 },
    sentenceComplexity: "complex",
    grammarStructures: [
      "Present perfect tense with recent events and life experience",
      "Past continuous/progressive tense",
      "Relative clauses (restrictive and non-restrictive with who, which, that, where)",
      "Conditional sentences (zero, first, second conditionals)",
      "Modal verbs for obligation, necessity, permission (must, should, can, may)",
      "Passive voice in simple present and past",
      "Reported speech/indirect speech (simple forms)",
      "Connectors and discourse markers (however, furthermore, meanwhile, finally)",
      "Subordinate clauses with because, although, while, when, if, unless",
      "Future tense forms (simple future, will, going to, present continuous for future)",
      "Present subjunctive/conditional mood (basic usage)",
      "Gerunds and infinitives after verbs",
      "Comparative and superlative structures with nuance",
      "Compound adjectives and descriptive phrases",
      "Prepositional phrases for detailed meaning",
    ],
    vocabDensity: { minItems: 15, maxItems: 25 },
    vocabType: "mixed",
    toneGuidance:
      "Natural storytelling with personality. Can include light humor and emotional range. Multiple perspectives or character voices. Show personal opinions and reactions.",
    exampleTopics: [
      "work life and career",
      "cultural experiences and travel stories",
      "personal relationships and social dynamics",
      "local customs and traditions",
      "health and wellness",
      "education and learning",
      "technology in daily life",
      "community and social issues",
    ],
  },

  b2: {
    level: "b2",
    label: "Upper Intermediate",
    wordCountRange: { min: 600, max: 1000 },
    sentenceComplexity: "complex",
    grammarStructures: [
      "Present perfect continuous tense",
      "Past perfect tense for narrative sequencing",
      "Advanced conditional forms (mixed conditionals, inversion structures)",
      "Subjunctive mood for expressions of wish, doubt, necessity, desire",
      "Passive voice in multiple tenses",
      "Complex relative clauses with prepositions",
      "Reported speech with backshifting and complex reporting verbs",
      "Cleft sentences and fronting for emphasis",
      "Advanced modal verbs (must have, might have, could have for speculation)",
      "Discourse markers and transitional phrases (nonetheless, whereas, in addition)",
      "Nominalization and abstract noun phrases",
      "Participle clauses (present and past)",
      "Inversion for stylistic effect (Not only...)",
      "Cohesive devices and thematic progression",
      "Idiomatic expressions and phrasal verbs",
    ],
    vocabDensity: { minItems: 18, maxItems: 30 },
    vocabType: "abstract",
    toneGuidance:
      "Sophisticated narrative voice with nuanced perspectives. Incorporate subtlety, irony, and implied meaning. Varied sentence structure for rhythm and emphasis.",
    exampleTopics: [
      "social and contemporary issues",
      "career challenges and professional ethics",
      "cultural identity and belonging",
      "technology and its implications",
      "cultural traditions and change",
      "personal values and beliefs",
      "environmental concerns",
      "human relationships and psychology",
    ],
  },

  c1: {
    level: "c1",
    label: "Advanced",
    wordCountRange: { min: 800, max: 1300 },
    sentenceComplexity: "advanced",
    grammarStructures: [
      "All perfect and progressive tenses in multiple contexts",
      "Full range of subjunctive mood including imperfect subjunctive",
      "Complex hypothetical constructions with multiple conditions",
      "Passive and causative constructions with nuance",
      "Advanced reported speech with tense and mood flexibility",
      "Thematic inversion and subject-verb inversion for stylistic purposes",
      "Dense relative and subordinate clause stacking",
      "Ellipsis and omission for rhetorical effect",
      "Advanced nominalizations and abstract structures",
      "Formal registers and register shifting",
      "Rhetorical structures (parallelism, antithesis, chiasmus)",
      "Complex modal expressions conveying degrees of certainty and obligation",
      "Advanced participle and gerund constructions",
      "Cohesion devices at discourse level",
      "Literary and poetic language structures",
    ],
    vocabDensity: { minItems: 20, maxItems: 35 },
    vocabType: "specialized",
    toneGuidance:
      "Literary quality with multiple perspectives and implicit meanings. Sophisticated humor and cultural references. Complex narrative techniques. Intellectual depth.",
    exampleTopics: [
      "philosophy and ethics",
      "art, literature, and aesthetics",
      "politics and governance",
      "identity and existential questions",
      "migration and belonging",
      "generational differences and social change",
      "intellectual history and ideas",
      "cultural critique and analysis",
    ],
  },

  c2: {
    level: "c2",
    label: "Mastery",
    wordCountRange: { min: 1000, max: 1600 },
    sentenceComplexity: "advanced",
    grammarStructures: [
      "Full range of grammatical structures with native-like flexibility",
      "Archaic and literary grammatical forms",
      "Register shifting between formal, informal, dialectal, and specialized registers",
      "Stylistic variation and conscious manipulation of syntax",
      "Complex metalinguistic and self-referential structures",
      "Subtle distinctions in mood and aspect across multiple tenses",
      "Advanced rhetorical structures including periodic sentences",
      "Compression techniques and economical expression",
      "Intentional grammatical ambiguity for effect",
      "Advanced use of punctuation for meaning and rhythm",
      "Nested and interlocking clause structures",
      "Allusion and intertextual grammatical references",
      "Dialect and sociolinguistic variation as artistic choice",
      "Near-native command of all aspectual and modal systems",
    ],
    vocabDensity: { minItems: 25, maxItems: 40 },
    vocabType: "literary",
    toneGuidance:
      "Publishable quality writing. Cultural and linguistic depth with nuance. Ambiguity and irony welcome. Multiple layers of meaning. Authentic voice and originality.",
    exampleTopics: [
      "any topic with cultural and linguistic depth",
      "abstract philosophical concepts",
      "literary and artistic analysis",
      "historical and social commentary",
      "complex human experiences",
      "linguistic and cultural phenomena",
      "speculative and imaginative concepts",
      "multifaceted social issues",
    ],
  },
};

// ─── Runtime override cache (loaded from DB on first use) ────────
let _runtimeRules: Record<CEFRLevel, PedagogicalRule> | null = null;
let _runtimeCacheTs = 0;
const RUNTIME_CACHE_TTL = 60_000; // 60s

/**
 * Load rules from DB if available, fallback to PEDAGOGICAL_RULES.
 * Caches for 60s. Safe to call from server components and agents.
 */
export async function loadPedagogicalRules(): Promise<Record<CEFRLevel, PedagogicalRule>> {
  const now = Date.now();
  if (_runtimeRules && now - _runtimeCacheTs < RUNTIME_CACHE_TTL) {
    return _runtimeRules;
  }

  try {
    // Dynamic import to avoid circular deps and keep this file importable everywhere
    const { prisma } = await import("@/lib/prisma");
    const row = await (prisma as any).studioConfig.findUnique({
      where: { key: "pedagogical_rules" },
    });

    if (row?.value && typeof row.value === "object") {
      _runtimeRules = row.value as Record<CEFRLevel, PedagogicalRule>;
      _runtimeCacheTs = now;
      return _runtimeRules;
    }
  } catch {
    // DB not available (table missing, sandbox, etc.) — use defaults
  }

  _runtimeRules = PEDAGOGICAL_RULES;
  _runtimeCacheTs = now;
  return _runtimeRules;
}

/** Force-clear the runtime cache (call after saving new config). */
export function invalidatePedagogicalCache(): void {
  _runtimeRules = null;
  _runtimeCacheTs = 0;
}

/**
 * Retrieve pedagogical rule for a given CEFR level (case-insensitive).
 * Synchronous — reads from hardcoded defaults or last-loaded cache.
 * For the freshest DB values, call loadPedagogicalRules() first.
 */
export function getRuleForLevel(level: string): PedagogicalRule | null {
  const normalizedLevel = level.toLowerCase() as CEFRLevel;
  const source = _runtimeRules ?? PEDAGOGICAL_RULES;
  return source[normalizedLevel] || null;
}

/**
 * Async version that ensures DB rules are loaded before returning.
 */
export async function getRuleForLevelAsync(level: string): Promise<PedagogicalRule | null> {
  const rules = await loadPedagogicalRules();
  const normalizedLevel = level.toLowerCase() as CEFRLevel;
  return rules[normalizedLevel] || null;
}

/**
 * Build a formatted context string for LLM prompts with pedagogical constraints
 * @param level CEFR level
 * @param language Target language for the story
 * @param topic Story topic
 * @returns Formatted prompt context string
 */
export function buildContentPromptContext(
  level: CEFRLevel,
  language: string,
  topic: string
): string {
  const source = _runtimeRules ?? PEDAGOGICAL_RULES;
  const rule = source[level];
  if (!rule) {
    throw new Error(`Invalid CEFR level: ${level}`);
  }

  return `
You are generating a language learning story for ${language} learners at the ${rule.label} (${level.toUpperCase()}) level.

## Content Constraints
- **Word Count**: ${rule.wordCountRange.min}-${rule.wordCountRange.max} words (IMPORTANT: aim for at least ${rule.wordCountRange.min} words — this story will be narrated as audio and must be at least 2 minutes long)
- **Topic**: ${topic}
- **Sentence Complexity**: ${rule.sentenceComplexity} (${rule.sentenceComplexity === "simple" ? "short, direct statements" : rule.sentenceComplexity === "compound" ? "connected with and/but/because" : rule.sentenceComplexity === "complex" ? "with subordinate clauses and relative clauses" : "advanced syntax with multiple nested structures"})
- **Vocabulary Items to Teach**: ${rule.vocabDensity.minItems}-${rule.vocabDensity.maxItems} new/important words
- **Vocabulary Type**: ${rule.vocabType} (${rule.vocabType === "concrete" ? "concrete nouns and simple verbs" : rule.vocabType === "mixed" ? "mix of concrete and abstract terms" : "abstract concepts and idiomatic expressions"})

## Grammar Structures to Include
${rule.grammarStructures.map((g) => `- ${g}`).join("\n")}

## Tone & Style
${rule.toneGuidance}

## Appropriate Topics for This Level
${rule.exampleTopics.map((t) => `- ${t}`).join("\n")}

## Instructions
1. Create an engaging, coherent narrative that naturally incorporates the grammar and vocabulary requirements above
2. Do not artificially force structures—they should flow naturally
3. Ensure learners can understand context from story structure and familiar elements
4. Include repetition of key vocabulary and structures
5. Make the story memorable and emotionally engaging
6. The narrative should feel authentic to the language and culture, not translated from English
`;
}
