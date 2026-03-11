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

type VocabItem = {
  word: string
  definition: string
  type?: string
}

function isGenPayload(x: unknown): x is GenPayload {
  if (typeof x !== 'object' || x === null) return false
  const obj = x as Record<string, unknown>
  return typeof obj.title === 'string' && typeof obj.text === 'string'
}

function isVocabItem(value: unknown): value is VocabItem {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.word === 'string' && typeof row.definition === 'string'
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function StoryGeneratorInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const currentTitle = useFormValue(['title']) as string | undefined
  const bookRef = useFormValue(['book', '_ref']) as string | undefined
  const language = useFormValue(['language']) as string | undefined
  const cefrLevel = useFormValue(['cefrLevel']) as string | undefined
  const level = useFormValue(['level']) as string | undefined
  const focus = useFormValue(['focus']) as string | undefined
  const topic = useFormValue(['topic']) as string | undefined
  const synopsis = useFormValue(['synopsis']) as string | undefined
  const text = useFormValue(['text']) as string | undefined
  const vocabRaw = useFormValue(['vocabRaw']) as string | undefined
  const coverAssetRef = useFormValue(['cover', 'asset', '_ref']) as string | undefined
  const audioAssetRef = useFormValue(['audio', 'asset', '_ref']) as string | undefined

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
  const [assetsLoading, setAssetsLoading] = useState(false)
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

  async function generateAssets() {
    try {
      setAssetsLoading(true)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Save the draft once before generating assets.')
      }

      const cleanTitle = currentTitle?.trim() ?? ''
      const cleanStoryText = stripHtml(text ?? '')
      const cleanSynopsis = synopsis?.trim() || cleanStoryText
      const hasExistingVocab = typeof vocabRaw === 'string' && vocabRaw.trim().length > 0
      const hasExistingCover = typeof coverAssetRef === 'string' && coverAssetRef.trim().length > 0
      const hasExistingAudio = typeof audioAssetRef === 'string' && audioAssetRef.trim().length > 0

      if (!cleanTitle) {
        throw new Error('Add a title before generating assets.')
      }
      if (!cleanStoryText) {
        throw new Error('Generate or add story text before generating assets.')
      }
      if (!cleanSynopsis) {
        throw new Error('Add a synopsis or story text before generating assets.')
      }

      const targetId = await getSanityTargetId(client, formId)
      const tasks: Array<Promise<string>> = []

      if (!hasExistingVocab) {
        tasks.push((async () => {
          const res = await fetch(`${apiBase}/api/generate-vocab`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanStoryText,
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
            error?: string
            details?: string
            generatedCount?: number
            minimumUsableItems?: number
          } = {}
          try {
            payload = raw ? (JSON.parse(raw) as typeof payload) : {}
          } catch {
            throw new Error(`Vocabulary: unexpected response ${raw.slice(0, 120)}`)
          }

          const rows = Array.isArray(payload.vocab) ? payload.vocab.filter(isVocabItem) : []
          const minimumUsableItems =
            typeof payload.minimumUsableItems === 'number' && Number.isFinite(payload.minimumUsableItems)
              ? payload.minimumUsableItems
              : 1

          if (!res.ok) {
            // The vocab API can return 422 with a still-usable rescued set.
            if (res.status !== 422 || rows.length < minimumUsableItems) {
              throw new Error(payload.error || payload.details || 'Vocabulary generation failed.')
            }
          }

          if (rows.length === 0) {
            throw new Error('Vocabulary: no usable items returned.')
          }

          await client.patch(targetId).set({ vocabRaw: JSON.stringify(rows, null, 2) }).commit()
          return res.ok ? `Vocabulary (${rows.length})` : `Vocabulary (${rows.length}, rescued set)`
        })())
      }

      if (!hasExistingCover) {
        tasks.push((async () => {
          const res = await fetch(`${apiBase}/api/sanity/generate-cover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'flux',
              documentId: formId,
              title: cleanTitle,
              synopsis: cleanSynopsis,
              language: typeof language === 'string' ? language : '',
              region: typeof region === 'string' ? region : '',
              topic: typeof topic === 'string' ? topic : '',
              level: resolvedBroadLevel,
            }),
          })

          let data: { error?: string; details?: string } = {}
          try {
            data = (await res.json()) as { error?: string; details?: string }
          } catch {
            throw new Error('Cover: server did not return valid JSON.')
          }
          if (!res.ok) {
            throw new Error(data.error || data.details || 'Cover generation failed.')
          }
          return 'Cover (Flux)'
        })())
      }

      if (!hasExistingAudio) {
        tasks.push((async () => {
          const res = await fetch(`${apiBase}/api/sanity/generate-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: formId,
              title: cleanTitle,
              text: cleanStoryText,
              language: typeof language === 'string' ? language : '',
              region: typeof region === 'string' ? region : '',
            }),
          })

          let data: { error?: string; details?: string } = {}
          try {
            data = (await res.json()) as { error?: string; details?: string }
          } catch {
            throw new Error('Audio: server did not return valid JSON.')
          }
          if (!res.ok) {
            throw new Error(data.error || data.details || 'Audio generation failed.')
          }
          return 'Audio'
        })())
      }

      const skipped: string[] = []
      if (hasExistingVocab) skipped.push('Vocabulary')
      if (hasExistingCover) skipped.push('Cover')
      if (hasExistingAudio) skipped.push('Audio')

      if (tasks.length === 0) {
        setMsg('✓ All assets already exist. Use the individual buttons if you want to regenerate one.')
        return
      }

      const results = await Promise.allSettled(tasks)
      const successes = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map((result) => result.value)
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason))

      if (successes.length > 0) {
        const skippedMsg = skipped.length > 0 ? `. Skipped existing: ${skipped.join(', ')}` : ''
        setMsg(`✓ Generated: ${successes.join(', ')}${skippedMsg}${failures.length > 0 ? `. Failed: ${failures.join(' · ')}` : '.'}`)
      } else {
        throw new Error(failures.join(' · ') || 'Asset generation failed.')
      }
    } catch (err) {
      const e = err as Error
      setError(e.message)
    } finally {
      setAssetsLoading(false)
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
            disabled={loading || synopsisLoading || titleLoading || assetsLoading}
            onClick={() => generateTitle()}
          />
          <Button
            icon={SparklesIcon}
            text={synopsisLoading ? 'Generating synopsis...' : 'Generate Synopsis'}
            mode="ghost"
            disabled={loading || synopsisLoading || titleLoading || assetsLoading}
            onClick={() => generateSynopsis()}
          />
          <Button
            icon={SparklesIcon}
            text={loading ? 'Generating...' : 'Generate Story'}
            tone="primary"
            disabled={loading || synopsisLoading || titleLoading || assetsLoading}
            onClick={() => generateStory()}
          />
          <Button
            icon={SparklesIcon}
            text={assetsLoading ? 'Generating assets...' : 'Generate Assets (Vocabulary + Cover + Audio)'}
            tone="positive"
            disabled={loading || synopsisLoading || titleLoading || assetsLoading}
            onClick={() => void generateAssets()}
          />
        </Flex>
      </Card>

      {(loading || synopsisLoading || titleLoading || assetsLoading) && (
        <Card padding={3}>
          <Spinner muted />{" "}
          <Text>
            {assetsLoading
              ? 'Generating vocabulary, cover, and audio in parallel...'
              : titleLoading
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
