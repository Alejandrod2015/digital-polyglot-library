'use client'

import dynamic from 'next/dynamic'

const NextStudio = dynamic(
  () => import('next-sanity/studio').then(mod => mod.NextStudio),
  { ssr: false }
)

import config from '../../../../../sanity.config'

export default function LegacySanityStudioPage() {
  return <NextStudio config={config} />
}
