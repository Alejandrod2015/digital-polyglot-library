// /src/types/books.ts

export type Level = "basic" | "intermediate" | "advanced";

export interface Story {
  id: string;
  title: string;
  text: string;
  dialogue: string;
  audio: string;
}

export interface Book {
  id: string;
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
