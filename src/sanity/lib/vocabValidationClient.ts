type VocabItem = {
  word: string
  surface?: string
  definition: string
  type?: string
}

type ValidateGeneratedVocabArgs = {
  apiBase: string
  text: string
  language: string
  vocab: VocabItem[]
  minItems?: number
  maxItems?: number
}

type ValidateGeneratedVocabResult = {
  vocab: VocabItem[]
  validationRaw: string
  successMessage: string
}

export async function validateGeneratedVocab({
  apiBase,
  text,
  language,
  vocab,
  minItems,
  maxItems,
}: ValidateGeneratedVocabArgs): Promise<ValidateGeneratedVocabResult> {
  const res = await fetch(`${apiBase}/api/validate-vocab`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      language,
      vocab,
      ...(typeof minItems === 'number' ? { minItems } : {}),
      ...(typeof maxItems === 'number' ? { maxItems } : {}),
    }),
  })

  const raw = await res.text()
  let payload: {
    vocab?: unknown
    issues?: unknown
    validation?: unknown
    error?: string
    details?: string
  } = {}
  try {
    payload = raw ? (JSON.parse(raw) as typeof payload) : {}
  } catch {
    throw new Error(`Unexpected validation response from server: ${raw.slice(0, 160)}`)
  }

  const validatedVocab = Array.isArray(payload.vocab) ? (payload.vocab as VocabItem[]) : []
  const issues = Array.isArray(payload.issues) ? payload.issues : []
  const validation = payload.validation && typeof payload.validation === 'object' ? payload.validation : {}

  if (!res.ok) {
    throw new Error(payload.error || payload.details || 'Vocabulary validation failed.')
  }

  return {
    vocab: validatedVocab,
    validationRaw: JSON.stringify({ validation, issues }, null, 2),
    successMessage:
      issues.length > 0
        ? `Vocabulary generated, validated, and cleaned (${validatedVocab.length} items).`
        : `Vocabulary generated and validated (${validatedVocab.length} items).`,
  }
}
