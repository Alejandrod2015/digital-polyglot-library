type VocabItem = {
  word: string
}

const MAX_HIGHLIGHT_WORDS = 30
const MAX_HIGHLIGHT_WORD_LENGTH = 48
const MAX_HIGHLIGHT_WORD_TOKENS = 4
const MAX_REGEX_SOURCE_LENGTH = 1400

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeVocabWords(vocab: VocabItem[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const item of vocab) {
    const word = typeof item?.word === 'string' ? item.word.trim() : ''
    if (!word) continue
    if (word.length < 3 || word.length > MAX_HIGHLIGHT_WORD_LENGTH) continue
    if (/[<>[\]{}]/.test(word)) continue
    const tokenCount = word.split(/\s+/).filter(Boolean).length
    if (tokenCount > MAX_HIGHLIGHT_WORD_TOKENS) continue

    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(word)
    if (out.length >= MAX_HIGHLIGHT_WORDS) break
  }

  return out
}

export function stripLegacyVocabSpans(text: string): string {
  return text.replace(
    /<span\s+[^>]*class=['"]vocab-word['"][^>]*>(.*?)<\/span>/giu,
    (_match, inner: string) => inner
  )
}

function highlightTextSegment(segment: string, vocabWords: string[]): string {
  if (!segment.trim() || vocabWords.length === 0) return segment

  const canonicalByLower = new Map(vocabWords.map((word) => [word.toLowerCase(), word] as const))
  const alternatives = [...vocabWords]
    .sort((a, b) => b.length - a.length)
    .map((word) => escapeRegex(word))

  const regexSource = alternatives.join('|')
  if (!regexSource || regexSource.length > MAX_REGEX_SOURCE_LENGTH) return segment

  let regex: RegExp
  try {
    regex = new RegExp(
      `(^|[^\\p{L}\\p{N}_])(${regexSource})(?=$|[^\\p{L}\\p{N}_])`,
      'giu'
    )
  } catch {
    return segment
  }

  return segment.replace(regex, (match: string, leading: string, found: string) => {
    const canonical = canonicalByLower.get(found.toLowerCase()) ?? found
    return `${leading}<span class="vocab-word" data-word="${canonical}">${found}</span>`
  })
}

export function rebuildTextWithHighlightedVocab(text: string, vocab: VocabItem[]): string {
  if (!text?.trim()) return text

  const vocabWords = normalizeVocabWords(vocab)
  if (vocabWords.length === 0) return stripLegacyVocabSpans(text)

  const cleanText = stripLegacyVocabSpans(text)
  const segments = cleanText.split(/(<[^>]+>)/g)

  return segments
    .map((segment) => (segment.startsWith('<') && segment.endsWith('>') ? segment : highlightTextSegment(segment, vocabWords)))
    .join('')
}
