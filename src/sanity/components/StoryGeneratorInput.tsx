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

  // 🆕 nuevos valores del formulario
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
        throw new Error('Tip: escribe algo en “Title” y pulsa Save una vez para crear el borrador.')
      }

      // 🧩 cuerpo dinámico para el endpoint
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

      // Solo incluir región si existe
      if (region && region.trim() !== '') {
        body.region = region
      }

      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to generate content')

      const data = await res.json()
      const raw = String(data.content ?? '')

      let parsedUnknown: unknown
      try {
        parsedUnknown = JSON.parse(raw)
      } catch {
        throw new Error('La respuesta no tiene un formato JSON válido.')
      }

      if (!isGenPayload(parsedUnknown)) {
        throw new Error('JSON inválido: faltan title/text/vocab o tipos incorrectos.')
      }

      const targetId = formId.startsWith('drafts.') ? formId : `drafts.${formId}`

      // 🪶 Guardar resultado en el borrador
      await client
        .patch(targetId)
        // si NO hay región seleccionada, elimínala del doc (no autocomplete)
        .unset(!region || region.trim() === '' ? ['region'] : [])
        // guarda campos generados
        .set({
          title: parsedUnknown.title?.trim() || 'Untitled',
          text: parsedUnknown.text?.trim() ?? '',
          vocabRaw: JSON.stringify(parsedUnknown.vocab, null, 2),
          // metadatos (sin forzar región)
          language: language ?? 'spanish',
          level: level ?? 'beginner',
          // usa claves en inglés para focus por consistencia con el endpoint
          focus: focus ?? 'verbs',
          topic: topic ?? 'daily life',
        })
        // si SÍ hay región, guárdala
        .set(region && region.trim() !== '' ? { region } : {})
        .commit()

      setMsg('✓ Historia generada en el borrador — revisa y pulsa Publish cuando quieras.')
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
