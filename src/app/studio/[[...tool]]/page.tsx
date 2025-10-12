'use client'

/**
 * This route mounts the Sanity Studio inside Next.js.
 * It must be a Client Component because the Studio uses React context and browser APIs.
 * See: https://github.com/sanity-io/next-sanity
 */

import { NextStudio } from 'next-sanity/studio'
import config from '../../../../sanity.config'

// ✅ Client-only render — no SSR, no metadata exports
export default function StudioPage() {
  return <NextStudio config={config} />
}
