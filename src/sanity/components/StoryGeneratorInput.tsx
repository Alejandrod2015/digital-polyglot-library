'use client'

import { useState } from 'react'
import { useFormValue, useClient } from 'sanity'
import { Button, Card, Text, Stack, Spinner } from '@sanity/ui'
import { SparklesIcon } from '@sanity/icons'

type GenPayload = {
  title: string
  text: string
  vocab: Array<{ word: string; definition: string }>
}

type VocabItem = { word: string; definition: string }

function isVocabItem(v: unknown): v is VocabItem {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return typeof obj.word === 'string' && typeof obj.definition === 'string'
}

function isGenPayload(x: unknown): x is GenPayload {
  if (typeof x !== 'object' || x === null) return false
  const obj = x as Record<string, unknown>
  return (
    typeof obj.title === 'string' &&
    typeof obj.text === 'string' &&
    Array.isArray(obj.vocab) &&
    obj.vocab.every(isVocabItem)
  )
}

export default function StoryGeneratorInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const bookRef = useFormValue(['book', '_ref']) as string | undefined

  // new form values
  const language = useFormValue(['language']) as string | undefined
  const region = useFormValue(['region']) as string | undefined
  const level = useFormValue(['level']) as string | undefined
  const focus = useFormValue(['focus']) as string | undefined
  const topic = useFormValue(['topic']) as string | undefined

  const client = useClient({ apiVersion: '2024-05-01' })

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    try {
      setLoading(true)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Tip: enter something in “Title” and click Save once to create a draft.')
      }

      // 🧩 dynamic body for the API endpoint
      const body: {
        language: string
        level: string
        focus: string
        topic: string
        bookId: string | null
        region?: string
      } = {
        language: language ?? 'Spanish',
        level: level ?? 'beginner',
        focus: focus ?? 'verbs',
        topic: topic ?? 'daily life',
        bookId: bookRef ?? null,
      }

      // include region only if provided
      if (region && region.trim() !== '') {
        body.region = region
      }

      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to generate content.')

      const data = await res.json()
      const raw = String(data.content ?? '')

      let parsedUnknown: unknown
      try {
        parsedUnknown = JSON.parse(raw)
      } catch {
        throw new Error('The response is not valid JSON.')
      }

      if (!isGenPayload(parsedUnknown)) {
        throw new Error('Invalid JSON: missing title/text/vocab or incorrect types.')
      }

      const targetId = formId.startsWith('drafts.') ? formId : `drafts.${formId}`

      // 🪶 save result in the draft
      await client
        .patch(targetId)
        // if no region selected, remove it (do not autocomplete)
        .unset(!region || region.trim() === '' ? ['region'] : [])
        // save generated fields
        .set({
          title: parsedUnknown.title?.trim() || 'Untitled',
          text: parsedUnknown.text?.trim() ?? '',
          vocabRaw: JSON.stringify(parsedUnknown.vocab, null, 2),
          // metadata (without forcing region)
          language: language ?? 'spanish',
          level: level ?? 'beginner',
          // use English keys for focus consistency with the API
          focus: focus ?? 'verbs',
          topic: topic ?? 'daily life',
        })
        // if region exists, store it
        .set(region && region.trim() !== '' ? { region } : {})
        .commit()

      setMsg('✓ Story generated in draft — review and click Publish when ready.')
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
        <Button
          icon={SparklesIcon}
          text={loading ? 'Generating...' : 'Generate Story with ChatGPT'}
          tone="primary"
          disabled={loading}
          onClick={handleGenerate}
        />
      </Card>

      {loading && (
        <Card padding={3}>
          <Spinner muted /> <Text>Generating story...</Text>
        </Card>
      )}

      {msg && (
        <Card padding={3} tone="positive">
          <Text>{msg}</Text>
        </Card>
      )}

      {error && (
        <Card padding={3} tone="critical">
          <Text>{error}</Text>
        </Card>
      )}
    </Stack>
  )
}
