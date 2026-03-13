'use client'

import { useState } from 'react'
import { useClient, useFormValue } from 'sanity'
import { Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { CheckmarkCircleIcon } from '@sanity/icons'
import { getSanityTargetId } from '../lib/getSanityTargetId'
import { validateGeneratedVocab } from '../lib/vocabValidationClient'

type VocabItem = {
  word: string
  definition: string
  type?: string
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseVocabRaw(value: string | undefined): VocabItem[] {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as VocabItem[]) : []
  } catch {
    return []
  }
}

export default function VocabValidatorInput() {
  const formId = useFormValue(['_id']) as string | undefined
  const text = useFormValue(['text']) as string | undefined
  const language = useFormValue(['language']) as string | undefined
  const vocabRaw = useFormValue(['vocabRaw']) as string | undefined
  const client = useClient({ apiVersion: '2024-05-01' })

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const apiBase =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? ''
      : 'https://reader.digitalpolyglot.com'

  async function validateVocab() {
    try {
      setLoading(true)
      setMsg(null)
      setError(null)

      if (!formId) {
        throw new Error('Save the draft once before validating vocabulary.')
      }

      const cleanedText = stripHtml(text ?? '')
      if (cleanedText.length < 120) {
        throw new Error('Add more story text before validating vocabulary.')
      }

      const currentVocab = parseVocabRaw(vocabRaw)
      if (currentVocab.length === 0) {
        throw new Error('Generate vocabulary first before validating it.')
      }

      const validated = await validateGeneratedVocab({
        apiBase,
        text: cleanedText,
        language: language ?? 'spanish',
        vocab: currentVocab,
      })

      const targetId = await getSanityTargetId(client, formId)
      await client
        .patch(targetId)
        .set({
          vocabRaw: JSON.stringify(validated.vocab, null, 2),
          vocabValidationRaw: validated.validationRaw,
        })
        .commit()

      setMsg(validated.successMessage)
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
            text={loading ? 'Validating vocabulary...' : 'Validate & Fix Vocabulary'}
            tone="positive"
            disabled={loading}
            onClick={validateVocab}
          />
          {loading ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1}>Cleaning definitions and removing weak items...</Text>
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

