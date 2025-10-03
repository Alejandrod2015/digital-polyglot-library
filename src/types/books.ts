// /src/types/books.ts

export type Level = "basic" | "intermediate" | "advanced";

export interface VocabItem {
  word: string;          // palabra tal cual aparece en el texto
  translation: string;   // traducción breve
  note?: string;         // opcional: matiz/nota cultural/ejemplo
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  text: string;
  audio: string;
  vocab?: VocabItem[];
}

export interface Book {
  id: string;
  slug: string;
  title: string;
  description: string; // usado como sinopsis

  // Nuevos campos
  subtitle?: string;          // Subtítulo opcional
  cover?: string;             // Ruta a /public/covers/...
  theme?: string | string[];  // Tema(s) del libro
  level?: Level;              // Nivel de dificultad

  audioFolder: string;
  stories: Story[];
}

// Labels útiles para mostrar en UI
export const LEVEL_LABELS: Record<Level, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
