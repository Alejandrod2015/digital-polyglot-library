'use client'

import { useState } from 'react'
import { useClient, useFormValue } from 'sanity'
import { Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { SparklesIcon } from '@sanity/icons'

type VocabItem = {
  word: string
  definition: string
  type?: string
}

function isVocabItem(value: unknown): value is VocabItem {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.word === 'string' && typeof row.definition === 'string'
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function VocabGeneratorInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const text = useFormValue(['text']) as string | undefined
  const language = useFormValue(['language']) as string | undefined
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
          level: level ?? 'intermediate',
          focus: focus ?? 'verbs',
          topic: topic ?? '',
          minItems: 20,
          maxItems: 25,
        }),
      })

      const raw = await res.text()
      let payload: {
        vocab?: unknown
        generatedCount?: number
        error?: string
        details?: string
      } = {}
      try {
        payload = raw ? (JSON.parse(raw) as typeof payload) : {}
      } catch {
        throw new Error(`Unexpected response from server: ${raw.slice(0, 120)}`)
      }

      if (!res.ok) {
        throw new Error(payload.error || payload.details || 'Failed to generate vocabulary.')
      }

      const rows = Array.isArray(payload.vocab) ? payload.vocab.filter(isVocabItem) : []
      if (rows.length < 20) {
        throw new Error('The model returned fewer than 20 valid vocab items. Try again.')
      }

      const targetId = formId.startsWith('drafts.') ? formId : `drafts.${formId}`
      await client
        .patch(targetId)
        .set({
          vocabRaw: JSON.stringify(rows, null, 2),
        })
        .commit()

      setMsg(`Vocabulary generated and saved (${rows.length} items).`)
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
              <Text size={1}>Extracting 20-25 items from story text...</Text>
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
