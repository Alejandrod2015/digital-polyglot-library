"use client"

import { useEffect, useMemo, useState } from "react"
import { useClient, useFormValue } from "sanity"
import { Button, Card, Flex, Text } from "@sanity/ui"
import { LaunchIcon } from "@sanity/icons"

type SlugValue = { current?: string }

export default function VisitStoryPageInput() {
  const slug = (useFormValue(["slug"]) as SlugValue | undefined)?.current?.trim() ?? ""
  const bookRef = (useFormValue(["book", "_ref"]) as string | undefined)?.trim() ?? ""
  const client = useClient({ apiVersion: "2025-10-05" })
  const [bookSlug, setBookSlug] = useState<string | null>(null)
  const [loadingBookSlug, setLoadingBookSlug] = useState(false)
  const [baseUrl, setBaseUrl] = useState(
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://reader.digitalpolyglot.com"
  )

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      setBaseUrl(window.location.origin);
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadBookSlug() {
      if (!bookRef) {
        setBookSlug(null)
        return
      }

      setLoadingBookSlug(true)
      try {
        const result = await client.fetch<{ slug?: { current?: string } } | null>(
          `*[_type == "book" && _id == $id][0]{slug}`,
          { id: bookRef }
        )

        if (!cancelled) {
          setBookSlug(result?.slug?.current?.trim() ?? null)
        }
      } catch {
        if (!cancelled) setBookSlug(null)
      } finally {
        if (!cancelled) setLoadingBookSlug(false)
      }
    }

    void loadBookSlug()

    return () => {
      cancelled = true
    }
  }, [bookRef, client])

  const href = useMemo(() => {
    if (!slug) return null

    if (bookRef) {
      if (!bookSlug) return null
      return `${baseUrl}/books/${bookSlug}/${slug}`
    }

    return `${baseUrl}/stories/${slug}`
  }, [baseUrl, bookRef, bookSlug, slug])

  const disabledReason = useMemo(() => {
    if (!slug) return "Add and save a slug first."
    if (bookRef && loadingBookSlug) return "Loading book URL..."
    if (bookRef && !bookSlug) return "Save the related book slug first."
    return null
  }, [bookRef, bookSlug, loadingBookSlug, slug])

  return (
    <Card padding={0} radius={2} shadow={0} tone="transparent">
      <Flex align="center" gap={3}>
        <Button
          as="a"
          href={href ?? undefined}
          target="_blank"
          rel="noreferrer"
          text="Visit Story Page"
          icon={LaunchIcon}
          tone="primary"
          disabled={!href}
        />
        {disabledReason ? (
          <Text size={1} muted>
            {disabledReason}
          </Text>
        ) : null}
      </Flex>
    </Card>
  )
}
