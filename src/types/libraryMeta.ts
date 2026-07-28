// Display metadata attached to My Library rows by /api/library, resolved
// server-side from the catalog tables. Kept free of server imports so the
// client component can type the payload without pulling in Prisma.

export type LibraryBookMeta = {
  slug: string;
  title: string;
  description?: string;
  cover?: string;
  language?: string;
  region?: string;
  level?: string;
  /** false only when the catalog explicitly marks the book unpublished. */
  published?: boolean;
  statsLine?: string;
  topicsLine?: string;
};

export type LibraryStoryMeta = {
  bookSlug: string;
  bookTitle: string;
  storySlug: string;
  title: string;
  language?: string;
  region?: string;
  level?: string;
  topic?: string;
  coverUrl?: string;
  audioUrl?: string | null;
};
