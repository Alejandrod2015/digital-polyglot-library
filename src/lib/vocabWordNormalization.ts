import { normalizeToken } from "@/lib/vocabSelection";

type NormalizeVocabWordArgs = {
  word: string;
  type?: string;
  language?: string;
};

function capitalizeGermanToken(token: string): string {
  return token
    .split("-")
    .map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) return trimmed;
      return trimmed[0].toLocaleUpperCase("de-DE") + trimmed.slice(1).toLocaleLowerCase("de-DE");
    })
    .join("-");
}

function normalizeGermanNoun(word: string): string {
  return word
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeGermanToken)
    .join(" ");
}

export function normalizeVocabWord(args: NormalizeVocabWordArgs): string {
  const rawWord = args.word.replace(/\s+/g, " ").trim();
  if (!rawWord) return rawWord;

  const language = normalizeToken(args.language ?? "");
  const type = normalizeToken(args.type ?? "");

  if (language === "german") {
    if (type === "noun") {
      return normalizeGermanNoun(rawWord);
    }

    return rawWord.toLocaleLowerCase("de-DE");
  }

  return rawWord;
}
