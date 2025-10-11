/**
 * Cliente Sanity universal.
 * Compatible con Next.js (local / Vercel) y Sanity Cloud.
 */

import { createClient } from 'next-sanity';

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-05-01',
  useCdn: true,
});
