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
  const audioAssetRef = useFormValue(['audio', 'asset', '_ref']) as string | undefined

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

      let data:
        | {
            error?: string
            details?: string
            audioQa?: {
              status?: 'pass' | 'warning' | 'fail' | 'unavailable'
              score?: number | null
              notes?: string[]
            }
          }
        | undefined
      try {
        data = (await res.json()) as {
          error?: string
          details?: string
          audioQa?: {
            status?: 'pass' | 'warning' | 'fail' | 'unavailable'
            score?: number | null
            notes?: string[]
          }
        }
      } catch {
        throw new Error('The server did not return valid JSON. Please try again.')
      }

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to generate audio.')
      }

      const qaStatus = data?.audioQa?.status
      const qaScore =
        typeof data?.audioQa?.score === 'number' ? `${Math.round(data.audioQa.score * 100)}%` : null

      if (qaStatus === 'pass') {
        setMsg(`Audio generated and attached successfully. QA passed${qaScore ? ` (${qaScore})` : ''}.`)
      } else if (qaStatus === 'warning' || qaStatus === 'fail') {
        const prefix = qaStatus === 'fail' ? 'Audio generated, but QA found a serious mismatch.' : 'Audio generated, but QA recommends a review.'
        const notes = Array.isArray(data?.audioQa?.notes) ? data.audioQa.notes.slice(0, 2).join(' ') : ''
        setError(`${prefix}${qaScore ? ` Similarity: ${qaScore}.` : ''}${notes ? ` ${notes}` : ''}`)
      } else {
        setMsg('Audio generated and attached successfully. QA result was unavailable.')
      }
    } catch (err) {
      const e = err as Error
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function analyzeExistingAudio() {
    try {
      setLoading(true)
      setMsg(null)
      setError(null)

      const documentId = toCleanText(formId)
      const cleanTitle = toCleanText(title)
      const cleanText = toCleanText(text)
      const cleanAudioRef = toCleanText(audioAssetRef)

      if (!documentId) throw new Error('Save the draft once before analyzing audio.')
      if (!cleanTitle) throw new Error('Add a title before analyzing audio.')
      if (!cleanText) throw new Error('Add story text before analyzing audio.')
      if (!cleanAudioRef) throw new Error('Generate or attach an audio file first.')

      const res = await fetch(`${apiBase}/api/sanity/analyze-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          title: cleanTitle,
          text: cleanText,
        }),
      })

      let data:
        | {
            error?: string
            details?: string
            audioQa?: {
              status?: 'pass' | 'warning' | 'fail' | 'unavailable'
              score?: number | null
              notes?: string[]
            }
          }
        | undefined
      try {
        data = (await res.json()) as {
          error?: string
          details?: string
          audioQa?: {
            status?: 'pass' | 'warning' | 'fail' | 'unavailable'
            score?: number | null
            notes?: string[]
          }
        }
      } catch {
        throw new Error('The server did not return valid JSON. Please try again.')
      }

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to analyze audio.')
      }

      const qaStatus = data?.audioQa?.status
      const qaScore =
        typeof data?.audioQa?.score === 'number' ? `${Math.round(data.audioQa.score * 100)}%` : null

      if (qaStatus === 'pass') {
        setMsg(`Existing audio analyzed successfully. QA passed${qaScore ? ` (${qaScore})` : ''}.`)
      } else if (qaStatus === 'warning' || qaStatus === 'fail') {
        const prefix = qaStatus === 'fail' ? 'Existing audio failed QA.' : 'Existing audio needs review.'
        const notes = Array.isArray(data?.audioQa?.notes) ? data.audioQa.notes.slice(0, 2).join(' ') : ''
        setError(`${prefix}${qaScore ? ` Similarity: ${qaScore}.` : ''}${notes ? ` ${notes}` : ''}`)
      } else {
        setMsg('Existing audio analyzed. QA result was unavailable.')
      }
    } catch (err) {
      const e = err as Error
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function analyzeDelivery() {
    try {
      setLoading(true)
      setMsg(null)
      setError(null)

      const documentId = toCleanText(formId)
      const cleanTitle = toCleanText(title)
      const cleanText = toCleanText(text)
      const cleanAudioRef = toCleanText(audioAssetRef)

      if (!documentId) throw new Error('Save the draft once before analyzing delivery.')
      if (!cleanTitle) throw new Error('Add a title before analyzing delivery.')
      if (!cleanText) throw new Error('Add story text before analyzing delivery.')
      if (!cleanAudioRef) throw new Error('Generate or attach an audio file first.')

      const res = await fetch(`${apiBase}/api/sanity/analyze-audio-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          title: cleanTitle,
          text: cleanText,
        }),
      })

      let data:
        | {
            error?: string
            details?: string
            audioDeliveryQa?: {
              status?: 'pass' | 'warning' | 'fail' | 'unavailable'
              score?: number | null
              notes?: string[]
            }
          }
        | undefined
      try {
        data = (await res.json()) as {
          error?: string
          details?: string
          audioDeliveryQa?: {
            status?: 'pass' | 'warning' | 'fail' | 'unavailable'
            score?: number | null
            notes?: string[]
          }
        }
      } catch {
        throw new Error('The server did not return valid JSON. Please try again.')
      }

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to analyze delivery.')
      }

      const qaStatus = data?.audioDeliveryQa?.status
      const qaScore =
        typeof data?.audioDeliveryQa?.score === 'number'
          ? `${Math.round(data.audioDeliveryQa.score * 100)}%`
          : null

      if (qaStatus === 'pass') {
        setMsg(`Delivery analyzed successfully. QA passed${qaScore ? ` (${qaScore})` : ''}.`)
      } else if (qaStatus === 'warning' || qaStatus === 'fail') {
        const prefix = qaStatus === 'fail' ? 'Delivery analysis found a serious pacing issue.' : 'Delivery analysis recommends a review.'
        const notes = Array.isArray(data?.audioDeliveryQa?.notes)
          ? data.audioDeliveryQa.notes.slice(0, 2).join(' ')
          : ''
        setError(`${prefix}${qaScore ? ` Score: ${qaScore}.` : ''}${notes ? ` ${notes}` : ''}`)
      } else {
        setMsg('Delivery analyzed. QA result was unavailable.')
      }
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
            tone="primary"
            disabled={loading}
            onClick={generateAudio}
          />
          <Button
            text={loading ? 'Analyzing...' : 'Analyze Existing Audio'}
            mode="ghost"
            disabled={loading}
            onClick={analyzeExistingAudio}
          />
          <Button
            text={loading ? 'Analyzing...' : 'Analyze Delivery'}
            mode="ghost"
            disabled={loading}
            onClick={analyzeDelivery}
          />
          {loading ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1}>Processing audio QA...</Text>
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
