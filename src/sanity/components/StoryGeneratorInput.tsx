'use client'

import { useState } from 'react'
import { useFormValue, useClient } from 'sanity'
import { Button, Card, Text, Stack, Spinner, Flex } from '@sanity/ui'
import { SparklesIcon } from '@sanity/icons'
import { getSanityTargetId } from '../lib/getSanityTargetId'
import { broadLevelFromCefr } from '../../lib/cefr'

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
  const variant = useFormValue(['variant']) as string | undefined
  const cefrLevel = useFormValue(['cefrLevel']) as string | undefined
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
  const [synopsisLoading, setSynopsisLoading] = useState(false)
  const [titleLoading, setTitleLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const apiBase =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? ''
      : 'https://reader.digitalpolyglot.com'
  const resolvedCefrLevel = typeof cefrLevel === 'string' ? cefrLevel : ''
  const resolvedBroadLevel = broadLevelFromCefr(resolvedCefrLevel) ?? level ?? 'beginner'

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
        variant?: string
        cefrLevel: string
        level: string
        focus: string
        topic: string
        synopsis: string
        bookId: string | null
        region?: string
      } = {
        language: language ?? 'Spanish',
        cefrLevel: resolvedCefrLevel,
        level: resolvedBroadLevel,
        focus: focus ?? 'verbs',
        topic: topic?.trim() ?? '',
        synopsis: synopsis?.trim() ?? '',
        bookId: bookRef ?? null,
      }

      if (region && region.trim() !== '') {
        body.region = region
      }
      if (variant && variant.trim() !== '') {
        body.variant = variant
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

      const targetId = await getSanityTargetId(client, formId)
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
          variant: variant?.trim() || undefined,
          level: resolvedBroadLevel,
          cefrLevel: resolvedCefrLevel || undefined,
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

  async function generateSynopsis() {
    try {
      setSynopsisLoading(true)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Tip: enter something in “Title” and click Save once to create a draft.')
      }

      const title = currentTitle?.trim() ?? ''
      if (!title) {
        throw new Error('Add a title first so the synopsis has something concrete to build from.')
      }

      const body: {
        title: string
        language: string
        variant?: string
        cefrLevel: string
        level: string
        focus: string
        topic: string
        region?: string
      } = {
        title,
        language: language ?? 'Spanish',
        cefrLevel: resolvedCefrLevel,
        level: resolvedBroadLevel,
        focus: focus ?? 'verbs',
        topic: topic?.trim() ?? '',
      }

      if (region && region.trim() !== '') {
        body.region = region
      }
      if (variant && variant.trim() !== '') {
        body.variant = variant
      }

      const res = await fetch(`${apiBase}/api/generate-synopsis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const rawResponse = await res.text()
      let data: { error?: string; result?: string } = {}
      try {
        data = rawResponse ? (JSON.parse(rawResponse) as typeof data) : {}
      } catch {
        throw new Error(`Unexpected response from server: ${rawResponse.slice(0, 120)}`)
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate synopsis.')
      }

      const nextSynopsis = String(data.result ?? '').trim()
      if (!nextSynopsis) {
        throw new Error('No synopsis was returned.')
      }

      const targetId = await getSanityTargetId(client, formId)
      await client.patch(targetId).set({ synopsis: nextSynopsis }).commit()
      setMsg('✓ Synopsis generated — review it before generating the story.')
    } catch (err) {
      const e = err as Error
      setError(e.message)
    } finally {
      setSynopsisLoading(false)
    }
  }

  async function generateTitle() {
    try {
      setTitleLoading(true)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Tip: click Save once to create a draft before generating a title.')
      }

      const body: {
        documentId: string
        language: string
        variant?: string
        cefrLevel: string
        level: string
        topic: string
        synopsis: string
        region?: string
      } = {
        documentId: formId.replace(/^drafts\./, ''),
        language: language ?? 'Spanish',
        cefrLevel: resolvedCefrLevel,
        level: resolvedBroadLevel,
        topic: topic?.trim() ?? '',
        synopsis: synopsis?.trim() ?? '',
      }

      if (region && region.trim() !== '') {
        body.region = region
      }
      if (variant && variant.trim() !== '') {
        body.variant = variant
      }

      const res = await fetch(`${apiBase}/api/generate-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const rawResponse = await res.text()
      let data: { error?: string; result?: string } = {}
      try {
        data = rawResponse ? (JSON.parse(rawResponse) as typeof data) : {}
      } catch {
        throw new Error(`Unexpected response from server: ${rawResponse.slice(0, 120)}`)
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate title.')
      }

      const nextTitle = String(data.result ?? '').trim()
      if (!nextTitle) {
        throw new Error('No title was returned.')
      }

      const targetId = await getSanityTargetId(client, formId)
      await client.patch(targetId).set({ title: nextTitle }).commit()
      setMsg('✓ Title generated — slug will update automatically.')
    } catch (err) {
      const e = err as Error
      setError(e.message)
    } finally {
      setTitleLoading(false)
    }
  }

  return (
    <Stack space={3}>
      <Card padding={3}>
        <Flex gap={3}>
          <Button
            icon={SparklesIcon}
            text={titleLoading ? 'Generating title...' : 'Generate Title'}
            mode="ghost"
            disabled={loading || synopsisLoading || titleLoading}
            onClick={() => generateTitle()}
          />
          <Button
            icon={SparklesIcon}
            text={synopsisLoading ? 'Generating synopsis...' : 'Generate Synopsis'}
            mode="ghost"
            disabled={loading || synopsisLoading || titleLoading}
            onClick={() => generateSynopsis()}
          />
          <Button
            icon={SparklesIcon}
            text={loading ? 'Generating...' : 'Generate Story'}
            tone="primary"
            disabled={loading || synopsisLoading || titleLoading}
            onClick={() => generateStory()}
          />
        </Flex>
      </Card>

      {(loading || synopsisLoading || titleLoading) && (
        <Card padding={3}>
          <Spinner muted />{" "}
          <Text>
            {titleLoading
              ? 'Generating title...'
              : synopsisLoading
                ? 'Generating synopsis...'
                : 'Generating story...'}
          </Text>
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
