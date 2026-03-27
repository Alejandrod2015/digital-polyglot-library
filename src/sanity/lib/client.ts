// /src/sanity/lib/client.ts
import { createClient } from "next-sanity";

const FALLBACK = {
  projectId: "9u7ilulp",
  dataset: "production",
  apiVersion: "2025-10-05",
};

function safeEnv(name: string, fallbackValue: string): string {
  // En navegador (Sanity Studio) usar fallback
  if (typeof window !== "undefined") return fallbackValue;

  const value = process.env[name];
  if (!value) {
    console.warn(`[sanity] Missing env var: ${name}, using fallback`);
    return fallbackValue;
  }
  return value;
}

// 🔒 Cliente de solo lectura — producción y localhost leen solo publicado
export const client = createClient({
  projectId: safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", FALLBACK.projectId),
  dataset: safeEnv("NEXT_PUBLIC_SANITY_DATASET", FALLBACK.dataset),
  apiVersion: safeEnv("NEXT_PUBLIC_SANITY_API_VERSION", FALLBACK.apiVersion),
  useCdn: true,               // ✅ acelera lecturas públicas
  perspective: "published",   // ✅ solo documentos publicados
});

// 🔍 Cliente de lectura fresca para reflejar cambios recién publicados sin esperar al CDN
export const freshClient = createClient({
  projectId: safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", FALLBACK.projectId),
  dataset: safeEnv("NEXT_PUBLIC_SANITY_DATASET", FALLBACK.dataset),
  apiVersion: safeEnv("NEXT_PUBLIC_SANITY_API_VERSION", FALLBACK.apiVersion),
  useCdn: false,
  perspective: "published",
});

// 🧪 Cliente raw para flujos locales/editoriales donde necesitamos ver drafts
export const rawServerClient = createClient({
  projectId: safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", FALLBACK.projectId),
  dataset: safeEnv("NEXT_PUBLIC_SANITY_DATASET", FALLBACK.dataset),
  apiVersion: safeEnv("NEXT_PUBLIC_SANITY_API_VERSION", FALLBACK.apiVersion),
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
  perspective: "raw",
});

// ✏️ Cliente de escritura — solo para acciones del servidor
export const writeClient = createClient({
  projectId: safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", FALLBACK.projectId),
  dataset: safeEnv("NEXT_PUBLIC_SANITY_DATASET", FALLBACK.dataset),
  apiVersion: safeEnv("NEXT_PUBLIC_SANITY_API_VERSION", FALLBACK.apiVersion),
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
  perspective: "published",
});
