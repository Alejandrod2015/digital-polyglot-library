import { createClient } from 'next-sanity';

function mustGet(name: 'NEXT_PUBLIC_SANITY_PROJECT_ID' | 'NEXT_PUBLIC_SANITY_DATASET' | 'NEXT_PUBLIC_SANITY_API_VERSION'): string {
  const v = process.env[name];
  if (!v) throw new Error(`[sanity] Missing env var: ${name}`);
  return v;
}

// DESPUÉS
export const client = createClient({
  projectId: '9u7ilulp',
  dataset: 'production',
  apiVersion: '2025-10-05',
  useCdn: true,
});

