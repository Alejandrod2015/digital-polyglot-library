export type Level = "beginner" | "intermediate" | "advanced";
export type CefrLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";
export type Variant = string;

export interface VocabItem {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
  note?: string;
}

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
  cover?: string;
  coverUrl?: string;
  vocab?: VocabItem[];
  tags?: string[];
  book?: Book;
  overrideMetadata?: boolean;
}

export interface Book extends BookMetadata {
  id: string;
  slug: string;
  title: string;
  description: string;
  subtitle?: string;
  createdAt?: string;
  updatedAt?: string;
  cover?: string;
  theme?: string | string[];
  audioFolder: string;
  stories: Story[];
  published?: boolean;
  storeUrl?: string;
}

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
