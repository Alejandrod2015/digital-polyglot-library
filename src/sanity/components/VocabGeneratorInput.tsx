'use client'

import { useState } from 'react'
import { useClient, useFormValue } from 'sanity'
import { Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { SparklesIcon } from '@sanity/icons'
import { getSanityTargetId } from '../lib/getSanityTargetId'
import { broadLevelFromCefr } from '../../lib/cefr'

type VocabItem = {
  word: string
  definition: string
  type?: string
}

const MAX_WORD_LENGTH = 48
const MAX_WORD_TOKENS = 4
const MAX_DEFINITION_WORDS = 36

function isVocabItem(value: unknown): value is VocabItem {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.word === 'string' && typeof row.definition === 'string'
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function appearsInText(text: string, phrase: string): boolean {
  const clean = phrase.trim()
  if (!clean) return false
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegex(clean)}(?=$|[^\\p{L}\\p{N}_])`,
    'iu'
  )
  return re.test(text)
}

function normalizeRows(rows: VocabItem[], text: string): VocabItem[] {
  const seen = new Set<string>()
  const out: VocabItem[] = []

  for (const row of rows) {
    const word = row.word.trim()
    const definition = row.definition.replace(/\s+/g, ' ').trim()
    if (!word || !definition) continue
    if (word.length < 3 || word.length > MAX_WORD_LENGTH) continue
    if (/[<>[\]{}]/.test(word)) continue
    const tokenCount = word.split(/\s+/).filter(Boolean).length
    if (tokenCount > MAX_WORD_TOKENS) continue
    if (!appearsInText(text, word)) continue
    const definitionWordCount = definition.split(/\s+/).filter(Boolean).length
    if (definitionWordCount < 4 || definitionWordCount > MAX_DEFINITION_WORDS) continue

    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      word,
      definition,
      ...(typeof row.type === 'string' && row.type.trim() ? { type: row.type.trim() } : {}),
    })
  }

  return out
}

export default function VocabGeneratorInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const text = useFormValue(['text']) as string | undefined
  const language = useFormValue(['language']) as string | undefined
  const cefrLevel = useFormValue(['cefrLevel']) as string | undefined
  const level = useFormValue(['level']) as string | undefined
  const focus = useFormValue(['focus']) as string | undefined
  const topic = useFormValue(['topic']) as string | undefined
  const client = useClient({ apiVersion: '2024-05-01' })

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const apiBase =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? ''
      : 'https://reader.digitalpolyglot.com'
  const resolvedCefrLevel = typeof cefrLevel === 'string' ? cefrLevel : ''
  const resolvedBroadLevel = broadLevelFromCefr(resolvedCefrLevel) ?? level ?? 'intermediate'

  async function generateVocab() {
    try {
      setLoading(true)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Save the draft once before generating vocabulary.')
      }

      const cleanedText = stripHtml(text ?? '')
      if (cleanedText.length < 120) {
        throw new Error('Add more story text before generating vocabulary.')
      }

      const res = await fetch(`${apiBase}/api/generate-vocab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanedText,
          language: language ?? 'spanish',
          cefrLevel: resolvedCefrLevel,
          level: resolvedBroadLevel,
          focus: focus ?? 'verbs',
          topic: topic ?? '',
        }),
      })

      const raw = await res.text()
      let payload: {
        vocab?: unknown
        generatedCount?: number
        minItems?: number
        maxItems?: number
        minimumUsableItems?: number
        error?: string
        details?: string
      } = {}
      try {
        payload = raw ? (JSON.parse(raw) as typeof payload) : {}
      } catch {
        throw new Error(`Unexpected response from server: ${raw.slice(0, 120)}`)
      }

      const rowsRaw = Array.isArray(payload.vocab) ? payload.vocab.filter(isVocabItem) : []
      const minItems =
        typeof payload.minItems === 'number' && Number.isFinite(payload.minItems)
          ? payload.minItems
          : 20
      const maxItems =
        typeof payload.maxItems === 'number' && Number.isFinite(payload.maxItems)
          ? payload.maxItems
          : 25
      const minimumUsableItems =
        typeof payload.minimumUsableItems === 'number' && Number.isFinite(payload.minimumUsableItems)
          ? payload.minimumUsableItems
          : Math.max(12, minItems - 4)
      const rows = normalizeRows(rowsRaw, cleanedText).slice(0, maxItems)

      if (!res.ok) {
        // The API can return 422 with a still-usable rescued set.
        if (res.status !== 422 || rows.length < minimumUsableItems) {
          throw new Error(payload.error || payload.details || 'Failed to generate vocabulary.')
        }
      }

      if (rows.length < minimumUsableItems) {
        throw new Error(
          `The model returned fewer than ${minimumUsableItems} usable vocab items. Try again.`
        )
      }

      const targetId = await getSanityTargetId(client, formId)
      await client
        .patch(targetId)
        .set({
          vocabRaw: JSON.stringify(rows, null, 2),
        })
        .commit()

      setMsg(
        res.ok
          ? `Vocabulary generated and saved (${rows.length} items).`
          : `Vocabulary generated and saved (${rows.length} items, rescued set).`
      )
    } catch (err) {
      const e = err as Error
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack space={3}>
      <Card padding={3}>
        <Flex gap={3} align="center">
          <Button
            icon={SparklesIcon}
            text={loading ? 'Generating vocabulary...' : 'Generate Vocabulary'}
            tone="primary"
            disabled={loading}
            onClick={generateVocab}
          />
          {loading ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1}>Extracting vocabulary from story text...</Text>
            </Flex>
          ) : null}
        </Flex>
      </Card>

      {msg ? (
        <Card padding={3} tone="positive">
          <Text>{msg}</Text>
        </Card>
      ) : null}

      {error ? (
        <Card padding={3} tone="critical">
          <Text>{error}</Text>
        </Card>
      ) : null}
    </Stack>
  )
}
