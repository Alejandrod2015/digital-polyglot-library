'use client'

import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Card, Flex, Spinner, Stack, Switch, Text, TextInput } from '@sanity/ui'
import { DocumentIcon } from '@sanity/icons'

type VocabItem = { word?: string; definition?: string; type?: string }

type CreateStoryListItem = {
  id: string
  title: string
  slug: string
  language: string | null
  level: string | null
  cefrLevel: string | null
  topic: string | null
  public: boolean
  coverUrl: string | null
  createdAt: string
}

type CreateStoryDetail = CreateStoryListItem & {
  text: string
  vocab: VocabItem[]
  variant: string | null
  region: string | null
  focus: string | null
  audioUrl: string | null
}

type EditorState = {
  title: string
  text: string
  language: string
  variant: string
  region: string
  level: string
  cefrLevel: string
  focus: string
  topic: string
  public: boolean
  vocabText: string
}

function matchesSearch(story: CreateStoryListItem, query: string): boolean {
  const haystack = [
    story.title,
    story.slug,
    story.language ?? '',
    story.level ?? '',
    story.cefrLevel ?? '',
    story.topic ?? '',
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

export default function CreateStoriesPane() {
  const [stories, setStories] = useState<CreateStoryListItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedStory, setSelectedStory] = useState<CreateStoryDetail | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  function toEditorState(story: CreateStoryDetail): EditorState {
    return {
      title: story.title ?? '',
      text: story.text ?? '',
      language: story.language ?? '',
      variant: story.variant ?? '',
      region: story.region ?? '',
      level: story.level ?? '',
      cefrLevel: story.cefrLevel ?? '',
      focus: story.focus ?? '',
      topic: story.topic ?? '',
      public: story.public,
      vocabText: JSON.stringify(story.vocab ?? [], null, 2),
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/studio/create-stories', { cache: 'no-store' })
        const data = (await res.json()) as { stories?: CreateStoryListItem[]; error?: string }

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load Create stories.')
        }

        if (!cancelled) {
          const nextStories = Array.isArray(data.stories) ? data.stories : []
          setStories(nextStories)
          if (nextStories.length > 0) {
            setSelectedId((current) => current ?? nextStories[0].id)
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load Create stories.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredStories = useMemo(() => {
    if (!search.trim()) return stories
    return stories.filter((story) => matchesSearch(story, search))
  }, [search, stories])

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      if (!selectedId) {
        setSelectedStory(null)
        setEditor(null)
        return
      }

      try {
        setLoadingDetail(true)
        setSaveError(null)
        setSaveMessage(null)

        const res = await fetch(`/api/user-stories?id=${encodeURIComponent(selectedId)}`, {
          cache: 'no-store',
        })
        const data = (await res.json()) as { story?: CreateStoryDetail; error?: string }

        if (!res.ok || !data.story) {
          throw new Error(data.error || 'Failed to load story.')
        }

        if (!cancelled) {
          setSelectedStory(data.story)
          setEditor(toEditorState(data.story))
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load story.'
          setSaveError(message)
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false)
        }
      }
    }

    loadDetail()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function handleSave() {
    if (!selectedId || !editor) return

    try {
      setSaving(true)
      setSaveError(null)
      setSaveMessage(null)

      let parsedVocab: VocabItem[] = []
      try {
        parsedVocab = editor.vocabText.trim() ? (JSON.parse(editor.vocabText) as VocabItem[]) : []
      } catch {
        throw new Error('Vocabulary must be valid JSON.')
      }

      const res = await fetch('/api/user-stories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedId,
          title: editor.title,
          text: editor.text,
          language: editor.language,
          variant: editor.variant,
          region: editor.region,
          level: editor.level,
          cefrLevel: editor.cefrLevel,
          focus: editor.focus,
          topic: editor.topic,
          public: editor.public,
          vocab: parsedVocab,
        }),
      })

      const data = (await res.json()) as { story?: CreateStoryDetail; error?: string }
      if (!res.ok || !data.story) {
        throw new Error(data.error || 'Failed to save story.')
      }

      setSelectedStory(data.story)
      setEditor(toEditorState(data.story))
      setStories((current) =>
        current.map((story) =>
          story.id === data.story!.id
            ? {
                ...story,
                title: data.story!.title,
                slug: data.story!.slug,
                language: data.story!.language,
                level: data.story!.level,
                cefrLevel: data.story!.cefrLevel,
                topic: data.story!.topic,
                public: data.story!.public,
                coverUrl: data.story!.coverUrl,
              }
            : story
        )
      )
      setSaveMessage('Saved')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save story.'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box padding={3}>
      <Flex gap={4} align="flex-start">
        <Box style={{ width: '42%', minWidth: 300 }}>
          <Stack space={3}>
            <TextInput
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search list"
            />

            {loading ? (
              <Flex align="center" gap={3} paddingY={4}>
                <Spinner muted />
                <Text size={1}>Loading stories…</Text>
              </Flex>
            ) : error ? (
              <Card padding={3} radius={2} tone="critical">
                <Text size={1}>{error}</Text>
              </Card>
            ) : filteredStories.length === 0 ? (
              <Text size={1} muted>
                No documents of this type
              </Text>
            ) : (
              <Stack space={1}>
                {filteredStories.map((story) => (
                  <Card
                    key={story.id}
                    padding={2}
                    radius={2}
                    tone={selectedId === story.id ? 'primary' : 'transparent'}
                    border
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedId(story.id)}
                  >
                    <Flex align="center" gap={3}>
                      {story.coverUrl ? (
                        <Box
                          style={{
                            width: 48,
                            height: 48,
                            overflow: 'hidden',
                            borderRadius: 4,
                            flexShrink: 0,
                            background: 'var(--card-bg-color)',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={story.coverUrl}
                            alt=""
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        </Box>
                      ) : (
                        <Flex
                          align="center"
                          justify="center"
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 4,
                            border: '1px solid var(--card-border-color)',
                            flexShrink: 0,
                          }}
                        >
                          <Text muted>
                            <DocumentIcon />
                          </Text>
                        </Flex>
                      )}

                      <Flex flex={1} align="center" justify="space-between" gap={3}>
                        <Stack space={2} flex={1}>
                          <Text size={2} weight="semibold" textOverflow="ellipsis">
                            {story.title}
                          </Text>
                          <Text size={1} muted textOverflow="ellipsis">
                            Create
                            {story.cefrLevel ? ` • CEFR ${story.cefrLevel.toUpperCase()}` : ''}
                            {story.level ? ` • Level: ${story.level}` : ''}
                          </Text>
                        </Stack>
                        <Text size={1} muted>
                          {story.public ? 'Public' : 'Private'}
                        </Text>
                      </Flex>
                    </Flex>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>

        <Box flex={1}>
          {loadingDetail ? (
            <Flex align="center" gap={3} paddingY={4}>
              <Spinner muted />
              <Text size={1}>Loading story…</Text>
            </Flex>
          ) : !editor || !selectedStory ? (
            <Text size={1} muted>
              Select a story to edit
            </Text>
          ) : (
            <Stack space={4}>
              <Flex justify="space-between" align="center">
                <Stack space={2}>
                  <Text size={3} weight="semibold">{selectedStory.title}</Text>
                  <Text size={1} muted>{selectedStory.slug}</Text>
                </Stack>
                <Flex align="center" gap={3}>
                  {saveMessage ? <Text size={1} muted>{saveMessage}</Text> : null}
                  <Button
                    text={saving ? 'Saving…' : 'Save'}
                    tone="primary"
                    onClick={handleSave}
                    disabled={saving}
                  />
                </Flex>
              </Flex>

              {saveError ? (
                <Card padding={3} radius={2} tone="critical">
                  <Text size={1}>{saveError}</Text>
                </Card>
              ) : null}

              <Flex gap={3}>
                <Box flex={1}>
                  <Text size={1} muted>Title</Text>
                  <TextInput
                    value={editor.title}
                    onChange={(event) => setEditor((current) => current ? { ...current, title: event.currentTarget.value } : current)}
                  />
                </Box>
                <Box flex={1}>
                  <Text size={1} muted>Topic</Text>
                  <TextInput
                    value={editor.topic}
                    onChange={(event) => setEditor((current) => current ? { ...current, topic: event.currentTarget.value } : current)}
                  />
                </Box>
              </Flex>

              <Flex gap={3}>
                <Box flex={1}>
                  <Text size={1} muted>Language</Text>
                  <TextInput
                    value={editor.language}
                    onChange={(event) => setEditor((current) => current ? { ...current, language: event.currentTarget.value } : current)}
                  />
                </Box>
                <Box flex={1}>
                  <Text size={1} muted>Variant</Text>
                  <TextInput
                    value={editor.variant}
                    onChange={(event) => setEditor((current) => current ? { ...current, variant: event.currentTarget.value } : current)}
                  />
                </Box>
                <Box flex={1}>
                  <Text size={1} muted>Region</Text>
                  <TextInput
                    value={editor.region}
                    onChange={(event) => setEditor((current) => current ? { ...current, region: event.currentTarget.value } : current)}
                  />
                </Box>
              </Flex>

              <Flex gap={3}>
                <Box flex={1}>
                  <Text size={1} muted>Level</Text>
                  <TextInput
                    value={editor.level}
                    onChange={(event) => setEditor((current) => current ? { ...current, level: event.currentTarget.value } : current)}
                  />
                </Box>
                <Box flex={1}>
                  <Text size={1} muted>CEFR</Text>
                  <TextInput
                    value={editor.cefrLevel}
                    onChange={(event) => setEditor((current) => current ? { ...current, cefrLevel: event.currentTarget.value } : current)}
                  />
                </Box>
                <Box flex={1}>
                  <Text size={1} muted>Focus</Text>
                  <TextInput
                    value={editor.focus}
                    onChange={(event) => setEditor((current) => current ? { ...current, focus: event.currentTarget.value } : current)}
                  />
                </Box>
              </Flex>

              <Flex align="center" gap={3}>
                <Switch
                  checked={editor.public}
                  onChange={(event) => setEditor((current) => current ? { ...current, public: event.currentTarget.checked } : current)}
                />
                <Text size={1}>Public</Text>
              </Flex>

              <Box>
                <Text size={1} muted>Text</Text>
                <textarea
                  value={editor.text}
                  onChange={(event) => setEditor((current) => current ? { ...current, text: event.currentTarget.value } : current)}
                  style={{
                    width: '100%',
                    minHeight: 260,
                    background: 'var(--card-bg-color)',
                    color: 'inherit',
                    border: '1px solid var(--card-border-color)',
                    borderRadius: 6,
                    padding: 12,
                    font: 'inherit',
                    lineHeight: 1.5,
                  }}
                />
              </Box>

              <Box>
                <Text size={1} muted>Vocabulary (JSON)</Text>
                <textarea
                  value={editor.vocabText}
                  onChange={(event) => setEditor((current) => current ? { ...current, vocabText: event.currentTarget.value } : current)}
                  style={{
                    width: '100%',
                    minHeight: 180,
                    background: 'var(--card-bg-color)',
                    color: 'inherit',
                    border: '1px solid var(--card-border-color)',
                    borderRadius: 6,
                    padding: 12,
                    font: '12px ui-monospace, SFMono-Regular, Menlo, monospace',
                    lineHeight: 1.5,
                  }}
                />
              </Box>
            </Stack>
          )}
        </Box>
      </Flex>
    </Box>
  )
}
