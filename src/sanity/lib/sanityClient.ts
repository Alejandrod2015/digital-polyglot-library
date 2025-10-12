import { createClient } from "next-sanity";

if (
  !process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  !process.env.NEXT_PUBLIC_SANITY_DATASET
) {
  console.error("❌ Missing Sanity environment variables");
}

// DESPUÉS
export const sanityClient = createClient({
  projectId: '9u7ilulp',
  dataset: 'production',
  apiVersion: '2025-10-05',
  useCdn: false,
});

