// /src/types/books.ts

export type Level = "beginner" | "intermediate" | "advanced";
export type CefrLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";
export type Variant = string;

export interface VocabItem {
  word: string; // Palabra tal cual aparece en el texto
  definition: string; // Definición breve
  type?: string; // Tipo gramatical opcional (verb, noun, expression, etc.)
  note?: string; // Nota cultural o ejemplo opcional
}

/** 🧭 Metadatos lingüísticos comunes entre libros e historias */
export interface BookMetadata {
  language: string;
  variant?: Variant;
  region?: string;
  level: Level;
  cefrLevel?: CefrLevel;
  topic?: string;
  formality?: "informal" | "neutral" | "formal";
}

export interface Story extends Partial<BookMetadata> {
  id: string;
  slug: string;
  title: string;
  text: string;
  audio: string;
  createdAt?: string;
  updatedAt?: string;

  /** 🖼️ Cover opcional por historia (Sanity -> export estático) */
  cover?: string;

  vocab?: VocabItem[];
  tags?: string[]; // Etiquetas o temas adicionales
  book?: Book; // 🔧 Ahora opcional para evitar errores en data local
  overrideMetadata?: boolean;
}

export interface Book extends BookMetadata {
  id: string;
  slug: string;
  title: string;
  description: string; // Sinopsis
  subtitle?: string; // Subtítulo opcional
  createdAt?: string;
  updatedAt?: string;

  /** Cover del libro (Sanity -> export estático) */
  cover?: string;

  theme?: string | string[];
  audioFolder: string;
  stories: Story[];
  published?: boolean;
  storeUrl?: string; // 🔗 Enlace opcional al libro físico en tienda
}

/** Etiquetas de nivel para mostrar en UI */
export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const CEFR_LEVEL_LABELS: Record<CefrLevel, string> = {
  a1: "A1",
  a2: "A2",
  b1: "B1",
  b2: "B2",
  c1: "C1",
  c2: "C2",
};
