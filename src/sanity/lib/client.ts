import { createClient } from 'next-sanity';

function mustGet(name: 'NEXT_PUBLIC_SANITY_PROJECT_ID' | 'NEXT_PUBLIC_SANITY_DATASET' | 'NEXT_PUBLIC_SANITY_API_VERSION'): string {
  const v = process.env[name];
  if (!v) throw new Error(`[sanity] Missing env var: ${name}`);
  return v;
}

export const client = createClient({
  projectId: mustGet('NEXT_PUBLIC_SANITY_PROJECT_ID'),
  dataset: mustGet('NEXT_PUBLIC_SANITY_DATASET'),
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-05-01',
  useCdn: true,
});
