// Client-safe blog helpers: types, dialect metadata, reading-time math,
// series clustering. Everything in this file MUST stay free of Node-only
// imports (no fs, path, etc.) so the client toolbar can import it.

export type BlogPostMeta = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  author?: string;
  tags?: string[];
  categories?: string[];
  hero?: string;
  readingMinutes?: number;
  dialect?: DialectKey;
  type?: PostTypeKey;
};

export type DialectKey =
  | "colombian"
  | "mexican"
  | "castilian"
  | "latam"
  | "brazilian"
  | "essays";

export type PostTypeKey =
  | "phrases"
  | "grammar"
  | "vocab"
  | "guide"
  | "essay";

export const POST_TYPES: Array<{ key: PostTypeKey; label: string }> = [
  { key: "phrases", label: "Phrases" },
  { key: "grammar", label: "Grammar" },
  { key: "vocab", label: "Vocab" },
  { key: "guide", label: "Guide" },
  { key: "essay", label: "Essay" },
];

// Same heuristic the per-post cover badge uses, hoisted here so the
// toolbar and the badge stay in sync.
export function classifyType(post: { title: string }): PostTypeKey {
  const t = post.title.toLowerCase();
  if (/phrase|expression|saying|idiom/.test(t)) return "phrases";
  if (/verb|adjective|noun|grammar|conjugat/.test(t)) return "grammar";
  if (/vocab|word|slang/.test(t)) return "vocab";
  if (/guide|how to|tips|ways/.test(t)) return "guide";
  return "essay";
}

export function getPostTypeCounts(posts: BlogPostMeta[]): Record<PostTypeKey, number> {
  const out: Record<PostTypeKey, number> = {
    phrases: 0,
    grammar: 0,
    vocab: 0,
    guide: 0,
    essay: 0,
  };
  for (const p of posts) {
    out[p.type ?? classifyType(p)] += 1;
  }
  return out;
}

export const DIALECTS: Array<{
  key: DialectKey;
  flag: string;
  label: string;
  short: string;
  gradient: [string, string];
}> = [
  {
    key: "colombian",
    flag: "🇨🇴",
    label: "Colombian",
    short: "Colombian Spanish",
    gradient: ["rgba(252,211,77,0.22)", "rgba(125,211,252,0.16)"],
  },
  {
    key: "mexican",
    flag: "🇲🇽",
    label: "Mexican",
    short: "Mexican Spanish",
    gradient: ["rgba(252,211,77,0.22)", "rgba(251,146,60,0.16)"],
  },
  {
    key: "castilian",
    flag: "🇪🇸",
    label: "Castilian",
    short: "Peninsular Spanish",
    gradient: ["rgba(196,181,253,0.20)", "rgba(251,146,60,0.16)"],
  },
  {
    key: "latam",
    flag: "🌎",
    label: "Latin American",
    short: "Latin American",
    gradient: ["rgba(251,146,60,0.20)", "rgba(252,211,77,0.14)"],
  },
  {
    key: "brazilian",
    flag: "🇧🇷",
    label: "Brazilian",
    short: "Brazilian Portuguese",
    gradient: ["rgba(190,242,100,0.20)", "rgba(125,211,252,0.14)"],
  },
  {
    key: "essays",
    flag: "✎",
    label: "Learning essays",
    short: "Learning essays",
    gradient: ["rgba(125,211,252,0.22)", "rgba(196,181,253,0.16)"],
  },
];

export function classifyDialect(post: { title: string }): DialectKey {
  const title = post.title.toLowerCase();
  if (/colombian|colombia|bogot/.test(title)) return "colombian";
  if (/mexican|mexico|méxic/.test(title)) return "mexican";
  if (/brazilian|portuguese|portugu/.test(title)) return "brazilian";
  if (/latin american|caribbean|latam/.test(title)) return "latam";
  if (/castilian|peninsular|vulgar/.test(title)) return "castilian";
  if (/spanish/.test(title)) return "latam";
  return "essays";
}

export function getDialectMeta(key: DialectKey) {
  return DIALECTS.find((d) => d.key === key) ?? DIALECTS[DIALECTS.length - 1];
}

export function getDialectCounts(posts: BlogPostMeta[]): Record<DialectKey, number> {
  const out: Record<DialectKey, number> = {
    colombian: 0,
    mexican: 0,
    castilian: 0,
    latam: 0,
    brazilian: 0,
    essays: 0,
  };
  for (const p of posts) {
    out[p.dialect ?? classifyDialect(p)] += 1;
  }
  return out;
}

export function computeReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 220));
}

export function getFeaturedPost(posts: BlogPostMeta[]): BlogPostMeta | null {
  return posts.find((p) => Boolean(p.hero)) ?? posts[0] ?? null;
}

export type BlogSeries = {
  id: string;
  name: string;
  subtitle: string;
  flag: string;
  count: number;
};

export function getBlogSeries(posts: BlogPostMeta[]): BlogSeries[] {
  const series: Array<Omit<BlogSeries, "count"> & { test: (p: BlogPostMeta) => boolean }> = [
    {
      id: "colombian-end-to-end",
      name: "Colombian Spanish, end to end",
      subtitle: "Idioms · slang · daily speech",
      flag: "🇨🇴",
      test: (p) => /colombian/i.test(p.title),
    },
    {
      id: "mexican-from-the-street",
      name: "Mexican Spanish from the street",
      subtitle: "Phrases · expressions · slang",
      flag: "🇲🇽",
      test: (p) => /mexican/i.test(p.title),
    },
    {
      id: "vulgar-peninsular",
      name: "Vulgar & informal peninsular",
      subtitle: "Real conversation, no filter",
      flag: "🇪🇸",
      test: (p) => /vulgar|slang|informal|peninsular/i.test(p.title),
    },
    {
      id: "ser-vs-estar",
      name: "Romance, ser vs. estar",
      subtitle: "Love metaphors · the two verbs",
      flag: "💛",
      test: (p) => /love|romant|ser.+estar/i.test(p.title),
    },
    {
      id: "health-spanish",
      name: "Health Spanish for travellers",
      subtitle: "Pharmacy · doctor · emergency",
      flag: "🩺",
      test: (p) => /health/i.test(p.title),
    },
  ];
  return series
    .map((s) => ({ ...s, count: posts.filter(s.test).length }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ test: _test, ...rest }) => rest);
}
