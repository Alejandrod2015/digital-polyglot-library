import fs from "fs";
import path from "path";
import { books } from "../src/data/books";
import type { Book, Story } from "../src/types/books";
import {
  inferBookTopicFromStoryTopics,
  inferTopicFromText,
  isGenericTopic,
  topTopics,
} from "../src/lib/topicClassifier";

const OUT_DIR = path.join(process.cwd(), "src/data/books");

function toConstName(raw: string): string {
  let s = (raw || "book").replace(/[^a-zA-Z0-9]/g, "");
  if (!s) s = "book";
  if (/^\d/.test(s)) s = `b${s}`;
  return s;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStory(story: Story, book: Book): Story {
  const inferredTopic = inferTopicFromText({
    title: story.title,
    text: story.text,
    existingTopic: story.topic,
    fallback: inferTopicFromText({
      title: book.title,
      description: book.description,
      existingTopic: book.topic,
      fallback: "Daily life",
    }),
  });

  const tags = Array.from(
    new Set([...(toStringArray(story.tags) ?? []), inferredTopic].filter(Boolean))
  );

  return {
    ...story,
    topic: inferredTopic,
    ...(tags.length > 0 ? { tags } : {}),
  };
}

function normalizeBook(book: Book): Book {
  const stories = Array.isArray(book.stories)
    ? book.stories.map((story) => normalizeStory(story, book))
    : [];

  const storyTopics = stories.map((story) => story.topic ?? "").filter(Boolean);
  const inferredBookTopic = inferBookTopicFromStoryTopics(storyTopics, {
    title: book.title,
    description: book.description,
    existingTopic: book.topic,
  });

  const existingTheme = toStringArray(book.theme);
  const inferredThemes = topTopics(storyTopics, 3);
  const theme =
    existingTheme.length > 0 && !existingTheme.every((entry) => isGenericTopic(entry))
      ? existingTheme
      : inferredThemes;

  return {
    ...book,
    topic: inferredBookTopic,
    theme,
    stories,
  };
}

function writeBookFile(book: Book) {
  const constName = toConstName(book.id);
  const filePath = path.join(OUT_DIR, `${book.id}.ts`);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Skipped (missing file): ${path.relative(process.cwd(), filePath)}`);
    return;
  }

  const content = `import { Book } from "@/types/books";

export const ${constName}: Book = ${JSON.stringify(book, null, 2)};
`;
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`✅ Updated topics: ${path.relative(process.cwd(), filePath)}`);
}

function main() {
  const allBooks = Object.values(books) as Book[];
  for (const book of allBooks) {
    const normalized = normalizeBook(book);
    writeBookFile(normalized);
  }
  console.log(`✨ Topic backfill completed for ${allBooks.length} books.`);
}

main();

