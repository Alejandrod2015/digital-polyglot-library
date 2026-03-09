'use client'

import { useEffect, useRef } from 'react'
import type { InputProps } from 'sanity'
import { useClient, useFormValue } from 'sanity'
import slugify from 'slugify'
import { getSanityTargetId } from '@/sanity/lib/getSanityTargetId'

type SlugValue = {
  current?: string
}

export default function AutoSlugInput(props: InputProps) {
  const formId = useFormValue(['_id']) as string | undefined
  const title = useFormValue(['title']) as string | undefined
  const currentSlug = (useFormValue(['slug']) as SlugValue | undefined)?.current
  const client = useClient({ apiVersion: '2024-05-01' })
  const lastAppliedRef = useRef<string | null>(null)

  useEffect(() => {
    const nextTitle = typeof title === 'string' ? title.trim() : ''
    if (!formId || !nextTitle) return

    const nextSlug = slugify(nextTitle, { lower: true, strict: true }).slice(0, 96)
    if (!nextSlug) return
    if (currentSlug === nextSlug) {
      lastAppliedRef.current = nextSlug
      return
    }
    if (lastAppliedRef.current === nextSlug) return

    lastAppliedRef.current = nextSlug

    void getSanityTargetId(client, formId)
      .then((targetId) =>
        client
          .patch(targetId)
          .set({ slug: { _type: 'slug', current: nextSlug } })
          .commit()
      )
      .catch(() => {
        lastAppliedRef.current = null
      })
  }, [client, currentSlug, formId, title])

  return props.renderDefault(props)
}
