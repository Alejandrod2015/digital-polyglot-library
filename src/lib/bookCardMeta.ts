import type { Book } from "@/types/books";
import { formatTopic } from "@/lib/displayFormat";

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function estimateReadMinutes(text: string): number {
  const words = stripHtml(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function toTopics(value: unknown): string[] {
  if (typeof value === "string") {
    const v = value.trim();
    return v ? [v] : [];
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function getBookCardMeta(book?: Book): { statsLine?: string; topicsLine?: string } {
  if (!book) return {};

  const storyCount = Array.isArray(book.stories) ? book.stories.length : 0;
  const totalMinutes = Array.isArray(book.stories)
    ? book.stories.reduce((sum, story) => sum + estimateReadMinutes(story.text ?? ""), 0)
    : 0;

  const rawTopics = [...toTopics(book.topic), ...toTopics(book.theme)];
  const uniqueTopics: string[] = [];
  const seen = new Set<string>();
  for (const topic of rawTopics) {
    const key = topic.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueTopics.push(formatTopic(topic));
    if (uniqueTopics.length >= 2) break;
  }

  const statsLine =
    storyCount > 0
      ? `${storyCount} ${storyCount === 1 ? "story" : "stories"} · ~${Math.max(1, totalMinutes)} min`
      : undefined;
  const topicsLine = uniqueTopics.length > 0 ? uniqueTopics.join(" · ") : undefined;

  return { statsLine, topicsLine };
}
