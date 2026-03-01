type TopicRule = {
  label: string;
  keywords: string[];
};

const TOPIC_RULES: TopicRule[] = [
  {
    label: "Relationships",
    keywords: [
      "love",
      "romance",
      "dating",
      "breakup",
      "couple",
      "friendship",
      "amor",
      "romance",
      "pareja",
      "amistad",
      "beziehung",
      "liebe",
      "freundschaft",
    ],
  },
  {
    label: "Work & Career",
    keywords: [
      "work",
      "office",
      "job",
      "career",
      "interview",
      "boss",
      "trabajo",
      "oficina",
      "empleo",
      "jefe",
      "arbeit",
      "büro",
      "job",
      "chef",
    ],
  },
  {
    label: "Travel & Transportation",
    keywords: [
      "travel",
      "trip",
      "journey",
      "airport",
      "station",
      "train",
      "bus",
      "subway",
      "metro",
      "u-bahn",
      "viaje",
      "aeropuerto",
      "estación",
      "tren",
      "autobús",
      "reise",
      "bahnhof",
      "zug",
      "flug",
      "verkehr",
    ],
  },
  {
    label: "Food & Cooking",
    keywords: [
      "food",
      "meal",
      "kitchen",
      "restaurant",
      "coffee",
      "cook",
      "recipe",
      "comida",
      "cocina",
      "restaurante",
      "café",
      "receta",
      "tacos",
      "essen",
      "küche",
      "restaurant",
      "kaffee",
      "rezept",
    ],
  },
  {
    label: "Family & Community",
    keywords: [
      "family",
      "parents",
      "mother",
      "father",
      "grandmother",
      "community",
      "familia",
      "madre",
      "padre",
      "abuela",
      "comunidad",
      "familie",
      "mutter",
      "vater",
      "gemeinschaft",
    ],
  },
  {
    label: "School & Learning",
    keywords: [
      "school",
      "student",
      "class",
      "teacher",
      "exam",
      "university",
      "escuela",
      "estudiante",
      "clase",
      "profesor",
      "examen",
      "universidad",
      "schule",
      "student",
      "unterricht",
      "prüfung",
    ],
  },
  {
    label: "Culture & Traditions",
    keywords: [
      "culture",
      "tradition",
      "festival",
      "ritual",
      "custom",
      "legend",
      "cultura",
      "tradición",
      "fiesta",
      "ritual",
      "leyenda",
      "kultur",
      "tradition",
      "fest",
      "ritual",
      "legende",
    ],
  },
  {
    label: "History & Places",
    keywords: [
      "history",
      "historical",
      "museum",
      "monument",
      "ancient",
      "city",
      "historia",
      "histórico",
      "museo",
      "monumento",
      "ciudad",
      "geschichte",
      "historisch",
      "museum",
      "denkmal",
      "stadt",
    ],
  },
  {
    label: "Nature & Environment",
    keywords: [
      "nature",
      "river",
      "mountain",
      "forest",
      "waterfall",
      "ocean",
      "naturaleza",
      "río",
      "montaña",
      "bosque",
      "cascada",
      "mar",
      "natur",
      "fluss",
      "berg",
      "wald",
      "wasserfall",
      "meer",
    ],
  },
  {
    label: "Mystery & Crime",
    keywords: [
      "mystery",
      "crime",
      "investigation",
      "police",
      "detective",
      "secret",
      "misterio",
      "crimen",
      "investigación",
      "policía",
      "detective",
      "secreto",
      "mysterium",
      "krimi",
      "polizei",
      "detektiv",
      "geheimnis",
    ],
  },
  {
    label: "Health & Wellness",
    keywords: [
      "health",
      "doctor",
      "hospital",
      "exercise",
      "wellness",
      "mental health",
      "salud",
      "doctor",
      "hospital",
      "ejercicio",
      "bienestar",
      "gesundheit",
      "arzt",
      "krankenhaus",
      "bewegung",
      "wohlbefinden",
    ],
  },
  {
    label: "Technology & Media",
    keywords: [
      "technology",
      "internet",
      "phone",
      "app",
      "social media",
      "camera",
      "tecnología",
      "internet",
      "móvil",
      "aplicación",
      "redes sociales",
      "cámara",
      "technologie",
      "internet",
      "handy",
      "app",
      "soziale medien",
      "kamera",
    ],
  },
  {
    label: "Money & Shopping",
    keywords: [
      "money",
      "price",
      "market",
      "shopping",
      "store",
      "budget",
      "dinero",
      "precio",
      "mercado",
      "compras",
      "tienda",
      "presupuesto",
      "geld",
      "preis",
      "markt",
      "einkaufen",
      "laden",
      "budget",
    ],
  },
  {
    label: "Emotions & Personal Growth",
    keywords: [
      "emotion",
      "fear",
      "anxiety",
      "decision",
      "confidence",
      "growth",
      "emociones",
      "miedo",
      "ansiedad",
      "decisión",
      "confianza",
      "crecimiento",
      "gefühle",
      "angst",
      "entscheidung",
      "vertrauen",
      "entwicklung",
    ],
  },
];

const GENERIC_TOPICS = new Set(
  [
    "",
    "daily life",
    "everyday life",
    "general",
    "generic",
    "misc",
    "miscellaneous",
    "other",
    "unknown",
  ].map((v) => normalize(v))
);

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ");
}

function scoreKeyword(source: string, keyword: string): number {
  const key = normalize(keyword);
  if (!key) return 0;

  if (key.includes(" ")) {
    return source.includes(key) ? 3 : 0;
  }

  const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  const matches = source.match(re);
  if (!matches) return 0;
  return Math.min(matches.length, 4);
}

export function isGenericTopic(topic?: string | null): boolean {
  if (!topic) return true;
  return GENERIC_TOPICS.has(normalize(topic));
}

export function inferTopicFromText(input: {
  title?: string;
  text?: string;
  description?: string;
  existingTopic?: string | null;
  fallback?: string;
}): string {
  const fallback = input.fallback ?? "Daily life";
  const normalizedExisting = normalize(input.existingTopic ?? "");
  const hasStrongExisting = normalizedExisting && !isGenericTopic(input.existingTopic);
  if (hasStrongExisting) {
    return input.existingTopic!.trim();
  }

  const title = normalize(input.title ?? "");
  const description = normalize(input.description ?? "");
  const text = normalize(stripHtml(input.text ?? "").slice(0, 12000));
  const source = [title, description, text].filter(Boolean).join(" ");
  if (!source) return fallback;

  let bestLabel = "";
  let bestScore = 0;

  for (const rule of TOPIC_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      score += scoreKeyword(source, keyword);
    }

    // Boost title matches for better precision.
    for (const keyword of rule.keywords) {
      const key = normalize(keyword);
      if (key && title.includes(key)) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestLabel = rule.label;
    }
  }

  return bestScore > 0 ? bestLabel : fallback;
}

export function inferBookTopicFromStoryTopics(
  storyTopics: string[],
  input: { title?: string; description?: string; existingTopic?: string | null }
): string {
  const counts = new Map<string, number>();
  for (const topic of storyTopics) {
    if (!topic || isGenericTopic(topic)) continue;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }

  let topTopic = "";
  let topCount = 0;
  for (const [topic, count] of counts.entries()) {
    if (count > topCount) {
      topCount = count;
      topTopic = topic;
    }
  }

  if (topTopic) return topTopic;

  return inferTopicFromText({
    title: input.title,
    description: input.description,
    existingTopic: input.existingTopic,
    fallback: "Daily life",
  });
}

export function topTopics(storyTopics: string[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const topic of storyTopics) {
    if (!topic || isGenericTopic(topic)) continue;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([topic]) => topic);
}

