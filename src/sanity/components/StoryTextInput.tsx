'use client'

import React from 'react'
import type { InputProps } from 'sanity'
import { Card, Stack, Text } from '@sanity/ui'

const MAX_TEXT_CHARS = 3800
const MAX_TEXT_WORDS = 500
const AUDIO_WPM_ESTIMATE = 140

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

export default function StoryTextInput(props: InputProps) {
  const value = asString(props.value)
  const chars = value.length
  const words = countWords(value)
  const estMinutes = words > 0 ? words / AUDIO_WPM_ESTIMATE : 0

  const charsLeft = MAX_TEXT_CHARS - chars
  const wordsLeft = MAX_TEXT_WORDS - words
  const overLimit = charsLeft < 0 || wordsLeft < 0

  return (
    <Stack space={3}>
      {props.renderDefault(props)}
      <Card padding={2} tone={overLimit ? 'critical' : 'transparent'}>
        <Text size={1} muted={!overLimit}>
          {`${chars}/${MAX_TEXT_CHARS} chars · ${words}/${MAX_TEXT_WORDS} words · ~${estMinutes.toFixed(1)} min audio`}
        </Text>
      </Card>
    </Stack>
  )
}
