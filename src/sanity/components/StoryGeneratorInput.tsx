'use client'

import { useState } from 'react'
import { useFormValue, useClient } from 'sanity'
import { Button, Card, Text, Stack, Spinner, Flex } from '@sanity/ui'
import { SparklesIcon } from '@sanity/icons'

type GenPayload = {
  title: string
  text: string
}

function isGenPayload(x: unknown): x is GenPayload {
  if (typeof x !== 'object' || x === null) return false
  const obj = x as Record<string, unknown>
  return typeof obj.title === 'string' && typeof obj.text === 'string'
}

export default function StoryGeneratorInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const currentTitle = useFormValue(['title']) as string | undefined
  const bookRef = useFormValue(['book', '_ref']) as string | undefined
  const language = useFormValue(['language']) as string | undefined
  const level = useFormValue(['level']) as string | undefined
  const focus = useFormValue(['focus']) as string | undefined
  const topic = useFormValue(['topic']) as string | undefined
  const synopsis = useFormValue(['synopsis']) as string | undefined

  // ✅ Detección automática del campo regional según idioma
  const regionKeyByLang = {
    spanish: 'region_es',
    english: 'region_en',
    german: 'region_de',
    french: 'region_fr',
    italian: 'region_it',
    portuguese: 'region_pt',
  } as const

  const langKey = (language ?? 'spanish').toLowerCase()
  const regionKey =
  (regionKeyByLang as Record<string, string>)[langKey] ?? 'region'
  const region = useFormValue([regionKey]) as string | undefined

  const client = useClient({ apiVersion: '2024-05-01' })

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const apiBase =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? ''
      : 'https://reader.digitalpolyglot.com'

  async function generateStory() {
    try {
      setLoading(true)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Tip: enter something in “Title” and click Save once to create a draft.')
      }

      const body: {
        language: string
        level: string
        focus: string
        topic: string
        synopsis: string
        bookId: string | null
        region?: string
      } = {
        language: language ?? 'Spanish',
        level: level ?? 'beginner',
        focus: focus ?? 'verbs',
        topic: topic?.trim() ?? '',
        synopsis: synopsis?.trim() ?? '',
        bookId: bookRef ?? null,
      }

      if (region && region.trim() !== '') {
        body.region = region
      }

      const res = await fetch(`${apiBase}/api/generate-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const rawResponse = await res.text()
      let data: {
        error?: string
        details?: string
        content?: string
        topic?: string
      } = {}
      try {
        data = rawResponse ? (JSON.parse(rawResponse) as typeof data) : {}
      } catch {
        throw new Error(`Unexpected response from server: ${rawResponse.slice(0, 120)}`)
      }
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to generate content.')
      }
      const raw = String(data.content ?? '')

      let parsedUnknown: unknown
      try {
        parsedUnknown = JSON.parse(raw)
      } catch {
        throw new Error('The response is not valid JSON.')
      }

      if (!isGenPayload(parsedUnknown)) {
        throw new Error('Invalid JSON: missing title/text or incorrect types.')
      }
      const hasExistingTitle = typeof currentTitle === 'string' && currentTitle.trim() !== ''

      const targetId = formId.startsWith('drafts.') ? formId : `drafts.${formId}`
      const patch = client.patch(targetId)

      // eliminar campo regional vacío
      if (!region || region.trim() === '') {
        patch.unset([regionKey])
      }

      // 🪶 Guardar resultado en el draft
      patch
        .set({
          text: parsedUnknown.text?.trim() ?? '',
          language: language ?? 'spanish',
          level: level ?? 'beginner',
          focus: focus ?? 'verbs',
          topic: topic?.trim() || data.topic || null,
        })
        .set(
          hasExistingTitle
            ? {}
            : { title: parsedUnknown.title?.trim() || 'Untitled' }
        )
        .set(region && region.trim() !== '' ? { [regionKey]: region } : {})

      await patch.commit()
      setMsg('✓ Story generated — review and click Publish when ready.')
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
        <Flex gap={3}>
          <Button
            icon={SparklesIcon}
            text={loading ? 'Generating...' : 'Generate Story'}
            tone="primary"
            disabled={loading}
            onClick={() => generateStory()}
          />
        </Flex>
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
