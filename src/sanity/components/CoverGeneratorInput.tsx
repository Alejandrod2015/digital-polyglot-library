'use client'

import { useState } from 'react'
import { Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { SparklesIcon } from '@sanity/icons'
import { useFormValue } from 'sanity'

const regionKeyByLang: Record<string, string> = {
  spanish: 'region_es',
  english: 'region_en',
  german: 'region_de',
  french: 'region_fr',
  italian: 'region_it',
  portuguese: 'region_pt',
}

function toSynopsis(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export default function CoverGeneratorInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const title = useFormValue(['title']) as string | undefined
  const text = useFormValue(['text']) as string | undefined
  const synopsisField = useFormValue(['synopsis']) as string | undefined
  const language = useFormValue(['language']) as string | undefined
  const level = useFormValue(['level']) as string | undefined
  const topic = useFormValue(['topic']) as string | undefined

  const langKey = (language ?? 'spanish').toLowerCase()
  const regionKey = regionKeyByLang[langKey] ?? 'region'
  const region = useFormValue([regionKey]) as string | undefined

  const [loadingProvider, setLoadingProvider] = useState<'openai' | 'flux' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const synopsis = toSynopsis(synopsisField) || toSynopsis(text)
  const apiBase =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? ''
      : 'https://reader.digitalpolyglot.com'

  async function generateCover(provider: 'openai' | 'flux') {
    try {
      setLoadingProvider(provider)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Save the draft once before generating the cover.')
      }

      if (!synopsis) {
        throw new Error('Add a synopsis (or story text) before generating the cover.')
      }

      const res = await fetch(`${apiBase}/api/sanity/generate-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          documentId: formId,
          title: typeof title === 'string' ? title : '',
          synopsis,
          language: typeof language === 'string' ? language : '',
          region: typeof region === 'string' ? region : '',
          topic: typeof topic === 'string' ? topic : '',
          level: typeof level === 'string' ? level : '',
        }),
      })

      let data: { error?: string; details?: string } = {}
      try {
        data = (await res.json()) as { error?: string; details?: string }
      } catch {
        throw new Error('The server did not return valid JSON. Please try again.')
      }
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to generate cover.')
      }

      setMsg(
        provider === 'flux'
          ? 'Cover generated with Flux and assigned successfully.'
          : 'Cover generated with OpenAI and assigned successfully.'
      )
    } catch (err) {
      const e = err as Error
      setError(e.message)
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <Stack space={3}>
      <Card padding={3}>
        <Flex gap={3} align="center">
          <Button
            icon={SparklesIcon}
            text={loadingProvider === 'openai' ? 'Generating with OpenAI...' : 'Generate Cover (OpenAI)'}
            tone="primary"
            disabled={loadingProvider !== null}
            onClick={() => generateCover('openai')}
          />
          <Button
            icon={SparklesIcon}
            text={loadingProvider === 'flux' ? 'Generating with Flux...' : 'Generate Cover (Flux)'}
            tone="positive"
            disabled={loadingProvider !== null}
            onClick={() => generateCover('flux')}
          />
          {loadingProvider ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1}>
                {loadingProvider === 'flux'
                  ? 'Creating image with Flux from synopsis...'
                  : 'Creating image with OpenAI from synopsis...'}
              </Text>
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
