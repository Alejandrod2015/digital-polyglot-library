'use client'

import { useState } from 'react'
import { useClient, useFormValue } from 'sanity'
import { Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { CheckmarkCircleIcon } from '@sanity/icons'
import { getSanityTargetId } from '../lib/getSanityTargetId'

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function StoryVocabQualityInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const text = useFormValue(['text']) as string | undefined
  const language = useFormValue(['language']) as string | undefined
  const client = useClient({ apiVersion: '2024-05-01' })

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const apiBase =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? ''
      : 'https://reader.digitalpolyglot.com'

  async function checkQuality() {
    try {
      setLoading(true)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Save the draft once before checking vocabulary quality.')
      }

      const cleanedText = stripHtml(text ?? '')
      if (cleanedText.length < 120) {
        throw new Error('Add more story text before checking vocabulary quality.')
      }

      const res = await fetch(`${apiBase}/api/check-story-vocab-quality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanedText,
          language: language ?? 'spanish',
        }),
      })

      const raw = await res.text()
      let payload: {
        quality?: unknown
        error?: string
        details?: string
      } = {}
      try {
        payload = raw ? (JSON.parse(raw) as typeof payload) : {}
      } catch {
        throw new Error(`Unexpected response from server: ${raw.slice(0, 120)}`)
      }

      if (!res.ok || !payload.quality || typeof payload.quality !== 'object') {
        throw new Error(payload.error || payload.details || 'Failed to assess vocabulary quality.')
      }

      const targetId = await getSanityTargetId(client, formId)
      await client
        .patch(targetId)
        .set({
          storyVocabQualityRaw: JSON.stringify(payload.quality, null, 2),
        })
        .commit()

      const quality = payload.quality as { status?: string; reason?: string }
      setMsg(
        quality.status === 'good'
          ? 'Story vocabulary quality looks strong.'
          : quality.status === 'usable'
            ? 'Story vocabulary quality is usable, but could be richer.'
            : quality.reason || 'Story vocabulary quality is weak.'
      )
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
            icon={CheckmarkCircleIcon}
            text={loading ? 'Checking story vocabulary...' : 'Check Story Vocabulary Quality'}
            mode="ghost"
            disabled={loading}
            onClick={checkQuality}
          />
          {loading ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1}>Assessing lexical richness and variety...</Text>
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

