/**
 * Cliente Sanity universal.
 * Compatible con Next.js (local / Vercel) y Sanity Cloud.
 */

import { createClient } from 'next-sanity'

export const client = createClient({
  projectId: '9u7ilulp',
  dataset: 'production',
  apiVersion: '2025-10-05',
  useCdn: true,
})
