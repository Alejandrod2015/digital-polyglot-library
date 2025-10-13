'use client'

import dynamic from 'next/dynamic'

// Evita que Next.js intente hacer SSR del Studio
const NextStudio = dynamic(
  () => import('next-sanity/studio').then(mod => mod.NextStudio),
  { ssr: false }
)

// Importa la config directamente
import config from '../../../../sanity.config'

export default function StudioPage() {
  return <NextStudio config={config} />
}
