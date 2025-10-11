// /src/types/books.ts

export type Level = "beginner" | "intermediate" | "advanced";

export interface VocabItem {
  word: string;          // palabra tal cual aparece en el texto
  definition: string;   // definición breve
  note?: string;         // opcional: matiz/nota cultural/ejemplo
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  text: string;
  audio: string;
  vocab?: VocabItem[];
  tags?: string[];       // NUEVO: etiquetas para futuras campañas
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
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
