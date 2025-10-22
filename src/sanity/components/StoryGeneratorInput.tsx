'use client'

import { useState } from 'react'
import { useFormValue, useClient } from 'sanity'
import { Button, Card, Text, Stack, Spinner, Flex } from '@sanity/ui'
import { SparklesIcon, PlayIcon } from '@sanity/icons'

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
  const language = useFormValue(['language']) as string | undefined
  const level = useFormValue(['level']) as string | undefined
  const focus = useFormValue(['focus']) as string | undefined
  const topic = useFormValue(['topic']) as string | undefined

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

  async function generateStory(withAudio: boolean) {
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
        bookId: string | null
        region?: string
      } = {
        language: language ?? 'Spanish',
        level: level ?? 'beginner',
        focus: focus ?? 'verbs',
        topic: topic ?? 'daily life',
        bookId: bookRef ?? null,
      }

      if (region && region.trim() !== '') {
        body.region = region
      }

      // ✅ si withAudio=true, se añade flag en query
      const res = await fetch(`/api/generate-text${withAudio ? '?withAudio=true' : ''}`, {
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
      const patch = client.patch(targetId)

      // eliminar campo regional vacío
      if (!region || region.trim() === '') {
        patch.unset([regionKey])
      }

      // 🪶 Guardar resultado en el draft
      patch
        .set({
          title: parsedUnknown.title?.trim() || 'Untitled',
          text: parsedUnknown.text?.trim() ?? '',
          vocabRaw: JSON.stringify(parsedUnknown.vocab, null, 2),
          language: language ?? 'spanish',
          level: level ?? 'beginner',
          focus: focus ?? 'verbs',
          topic: topic ?? 'daily life',
        })
        .set(region && region.trim() !== '' ? { [regionKey]: region } : {})

      // si hay audio generado, asignarlo al campo audio
      if (withAudio && data.audioAssetId) {
        patch.set({
          audio: {
            _type: 'file',
            asset: { _type: 'reference', _ref: data.audioAssetId },
          },
        })
      }

      await patch.commit()
      setMsg(`✓ Story generated${withAudio ? ' with audio' : ''} — review and click Publish when ready.`)
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
            onClick={() => generateStory(false)}
          />
          <Button
            icon={PlayIcon}
            text={loading ? 'Generating...' : 'Generate Story + Audio'}
            tone="positive"
            disabled={loading}
            onClick={() => generateStory(true)}
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
