'use client'

import { useState } from 'react'
import { useFormValue } from 'sanity'
import { Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { PlayIcon } from '@sanity/icons'

const regionKeyByLang: Record<string, string> = {
  spanish: 'region_es',
  english: 'region_en',
  german: 'region_de',
  french: 'region_fr',
  italian: 'region_it',
  portuguese: 'region_pt',
}

function toCleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export default function AudioGeneratorInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const title = useFormValue(['title']) as string | undefined
  const text = useFormValue(['text']) as string | undefined
  const language = useFormValue(['language']) as string | undefined

  const langKey = (language ?? 'spanish').toLowerCase()
  const regionKey = regionKeyByLang[langKey] ?? 'region'
  const region = useFormValue([regionKey]) as string | undefined

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const apiBase =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? ''
      : 'https://reader.digitalpolyglot.com'

  async function generateAudio() {
    try {
      setLoading(true)
      setMsg(null)
      setError(null)

      const documentId = toCleanText(formId)
      const cleanTitle = toCleanText(title)
      const cleanText = toCleanText(text)
      const cleanLanguage = toCleanText(language)
      const cleanRegion = toCleanText(region)

      if (!documentId) throw new Error('Save the draft once before generating audio.')
      if (!cleanTitle) throw new Error('Add a title before generating audio.')
      if (!cleanText) throw new Error('Add story text before generating audio.')

      const res = await fetch(`${apiBase}/api/sanity/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          title: cleanTitle,
          text: cleanText,
          language: cleanLanguage,
          region: cleanRegion,
        }),
      })

      let data: { error?: string; details?: string } = {}
      try {
        data = (await res.json()) as { error?: string; details?: string }
      } catch {
        throw new Error('The server did not return valid JSON. Please try again.')
      }

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to generate audio.')
      }

      setMsg('Audio generated and attached successfully.')
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
            icon={PlayIcon}
            text={loading ? 'Generating audio...' : 'Generate Audio'}
            tone="positive"
            disabled={loading}
            onClick={generateAudio}
          />
          {loading ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1}>Creating audio from story text...</Text>
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
