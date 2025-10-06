'use client'

import { useState } from 'react'
import { useFormValue, useClient } from 'sanity'
import { Button, Card, Text, Stack, Spinner } from '@sanity/ui'
import { SparklesIcon } from '@sanity/icons'

export default function StoryGeneratorInput() {
  // id del doc (draft o published)
  const formId = useFormValue(['_id']) as string | undefined
  // 👇 referencia al libro relacionado (para el endpoint)
  const bookRef = useFormValue(['book', '_ref']) as string | undefined

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

      const body = {
        language: 'German',
        level: 'intermediate',
        theme: 'Hamburg nightlife and culture',
        includeFree: true,
        bookId: bookRef ?? null, // 👈 ahora se envía al endpoint
      }

      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to generate content')

      const data = await res.json()
      const content = data.content || ''

      const titleMatch = content.match(/Title:\s*(.*)/i)
      const vocabMatch = content.match(/vocab:\s*\[([\s\S]*)\]/i)
      const storyText = content.replace(/Title:.*|vocab:\s*\[[\s\S]*\]/gi, '').trim()
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
      const vocab = vocabMatch ? `[${vocabMatch[1].trim()}]` : ''

      const targetId = formId.startsWith('drafts.') ? formId : `drafts.${formId}`

      await client
        .patch(targetId)
        .set({
          title,
          text: storyText,
          vocabRaw: vocab,
          level: 'intermediate',
          theme: ['Culture', 'Urban life', 'Hamburg'],
          isFree: true,
        })
        .commit()

      setMsg('Story escrita en el borrador ✓ — revisa y pulsa Publish cuando quieras.')
    } catch (err) {
  const error = err as Error;
  setError(error.message);
}
 finally {
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
