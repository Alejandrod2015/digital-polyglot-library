type MultiwordOptions = {
  storyText?: string;
  type?: string;
};

const ALLOWED_MULTIWORD_TYPES = new Set(["expression", "connector", "slang"]);

export function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function splitWordTokens(word: string): string[] {
  return normalizeToken(word)
    .split(/[\s\-_/]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function collectFrequentShortTokens(text: string): Set<string> {
  const counts = new Map<string, number>();
  const matches = text.match(/[\p{L}\p{M}]+/gu) ?? [];

  for (const rawToken of matches) {
    const token = normalizeToken(rawToken);
    if (!token || token.length > 4) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([token]) => token)
  );
}

function isLikelySentenceFragment(tokens: string[], storyText: string): boolean {
  if (tokens.length <= 1) return false;

  const frequentShortTokens = collectFrequentShortTokens(storyText);
  const frequentShortCount = tokens.filter((token) => frequentShortTokens.has(token)).length;
  const contentTokenCount = tokens.filter((token) => !frequentShortTokens.has(token)).length;

  if (tokens.length >= 3 && frequentShortCount >= 2) return true;
  if (tokens.length >= 3 && contentTokenCount <= 1) return true;
  if (tokens.length === 2 && tokens.every((token) => token.length >= 5)) return true;
  if (tokens.length >= 4) return true;

  return false;
}

export function isInvalidMultiwordVocab(word: string, options: MultiwordOptions = {}): boolean {
  const tokens = splitWordTokens(word);
  if (tokens.length <= 1) return false;
  if (/[,.!?;:“”"«»()[\]{}]/u.test(word)) return true;
  if (tokens.length > 3) return true;

  const normalizedType = normalizeToken(options.type ?? "");
  if (!ALLOWED_MULTIWORD_TYPES.has(normalizedType)) return true;

  // Prefer very short lexicalized expressions like "de repente" over generic collocations.
  if (tokens.length >= 2 && !tokens.some((token) => token.length <= 3)) return true;

  if (options.storyText && isLikelySentenceFragment(tokens, options.storyText)) {
    return true;
  }

  return false;
}
