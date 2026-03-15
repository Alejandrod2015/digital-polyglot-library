'use client'

import { useEffect, useMemo, useState } from 'react'
import { useClient } from 'sanity'
import { Box, Card, Flex, Spinner, Stack, Text, TextInput } from '@sanity/ui'

type SanityStory = {
  _id: string
  _type: 'story' | 'standaloneStory'
  title: string
  slug?: string | null
  language?: string | null
  cefrLevel?: string | null
  level?: string | null
  topic?: string | null
  published?: boolean | null
  updatedAt?: string | null
}

type CreateStory = {
  id: string
  title: string
  slug: string
  language: string | null
  level: string | null
  cefrLevel: string | null
  topic: string | null
  public: boolean
  createdAt: string
  creatorName: string
  creatorEmail: string | null
}

type UnifiedStory = {
  id: string
  source: 'book' | 'sanity' | 'create'
  title: string
  slug: string | null
  language: string | null
  cefrLevel: string | null
  level: string | null
  topic: string | null
  statusLabel: string
  secondaryLabel: string
  sortDate: string | null
}

function formatDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function matchesSearch(story: UnifiedStory, query: string): boolean {
  const haystack = [
    story.title,
    story.slug ?? '',
    story.language ?? '',
    story.level ?? '',
    story.cefrLevel ?? '',
    story.topic ?? '',
    story.source,
    story.secondaryLabel,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

const SANITY_STORIES_QUERY = `{
  "bookStories": *[_type == "story" && defined(book._ref)] | order(_updatedAt desc) {
    _id,
    _type,
    title,
    "slug": slug.current,
    language,
    cefrLevel,
    level,
    topic,
    published,
    "updatedAt": _updatedAt
  },
  "sanityStories": *[_type == "standaloneStory"] | order(_updatedAt desc) {
    _id,
    _type,
    title,
    "slug": slug.current,
    language,
    cefrLevel,
    level,
    topic,
    published,
    "updatedAt": _updatedAt
  }
}`

export default function AllStoriesPane() {
  const client = useClient({ apiVersion: '2025-10-05' })
  const [stories, setStories] = useState<UnifiedStory[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const [sanityData, createRes] = await Promise.all([
          client.fetch<{ bookStories?: SanityStory[]; sanityStories?: SanityStory[] }>(SANITY_STORIES_QUERY),
          fetch('/api/studio/create-stories', { cache: 'no-store' }),
        ])

        const createData = (await createRes.json()) as { stories?: CreateStory[]; error?: string }
        if (!createRes.ok) {
          throw new Error(createData.error || 'Failed to load Create stories.')
        }

        const bookStories = (sanityData?.bookStories ?? []).map<UnifiedStory>((story) => ({
          id: story._id,
          source: 'book',
          title: story.title,
          slug: story.slug ?? null,
          language: story.language ?? null,
          cefrLevel: story.cefrLevel ?? null,
          level: story.level ?? null,
          topic: story.topic ?? null,
          statusLabel: story.published ? 'Published' : 'Draft',
          secondaryLabel: 'Book Story',
          sortDate: story.updatedAt ?? null,
        }))

        const sanityStories = (sanityData?.sanityStories ?? []).map<UnifiedStory>((story) => ({
          id: story._id,
          source: 'sanity',
          title: story.title,
          slug: story.slug ?? null,
          language: story.language ?? null,
          cefrLevel: story.cefrLevel ?? null,
          level: story.level ?? null,
          topic: story.topic ?? null,
          statusLabel: story.published ? 'Published' : 'Draft',
          secondaryLabel: 'Sanity Story',
          sortDate: story.updatedAt ?? null,
        }))

        const createStories = (createData.stories ?? []).map<UnifiedStory>((story) => ({
          id: story.id,
          source: 'create',
          title: story.title,
          slug: story.slug,
          language: story.language,
          cefrLevel: story.cefrLevel,
          level: story.level,
          topic: story.topic,
          statusLabel: story.public ? 'Public' : 'Private',
          secondaryLabel: `Create Story · ${story.creatorName}`,
          sortDate: story.createdAt,
        }))

        const merged = [...bookStories, ...sanityStories, ...createStories].sort((a, b) => {
          const aTime = a.sortDate ? new Date(a.sortDate).getTime() : 0
          const bTime = b.sortDate ? new Date(b.sortDate).getTime() : 0
          return bTime - aTime
        })

        if (!cancelled) {
          setStories(merged)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load stories.'
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
  }, [client])

  const filteredStories = useMemo(() => {
    if (!search.trim()) return stories
    return stories.filter((story) => matchesSearch(story, search))
  }, [search, stories])

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Text size={1} muted>
          Unified list of book stories, Sanity stories, and Create stories from polyglot users.
        </Text>

        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Search title, slug, source, topic"
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
          <Card padding={4} radius={2} tone="transparent" border>
            <Text size={1}>No stories found.</Text>
          </Card>
        ) : (
          <Stack space={3}>
            {filteredStories.map((story) => (
              <Card key={`${story.source}-${story.id}`} padding={3} radius={2} border>
                <Stack space={3}>
                  <Flex justify="space-between" align="flex-start" gap={3}>
                    <Stack space={2} flex={1}>
                      <Text size={2} weight="semibold">
                        {story.title}
                      </Text>
                      <Text size={1} muted>
                        {story.secondaryLabel}
                        {story.slug ? ` · ${story.slug}` : ''}
                      </Text>
                    </Stack>
                    <Text size={1} muted>
                      {formatDate(story.sortDate)}
                    </Text>
                  </Flex>

                  <Flex wrap="wrap" gap={3}>
                    <Text size={1}>Source: {story.source}</Text>
                    {story.language ? <Text size={1}>Language: {story.language}</Text> : null}
                    {story.cefrLevel ? <Text size={1}>CEFR: {story.cefrLevel.toUpperCase()}</Text> : null}
                    {story.level ? <Text size={1}>Level: {story.level}</Text> : null}
                    {story.topic ? <Text size={1}>Topic: {story.topic}</Text> : null}
                    <Text size={1}>{story.statusLabel}</Text>
                  </Flex>
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
