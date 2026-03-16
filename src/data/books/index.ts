import type { Book } from "@/types/books";
import { colloquialgermanstories } from "./colloquial-german-stories";
import { colombianspanishstoriesforbeginners } from "./colombian-spanish-stories-for-beginners";
import { shortstoriesincolombianspanish } from "./short-stories-in-colombian-spanish";
import { spanishshortstorieson20mexicanwonders } from "./spanish-short-stories-on-20-mexican-wonders";
import { resolveCatalogAudioUrl, resolveCatalogImageUrl } from "@/lib/publicMedia";

function normalizeCatalogBook(book: Book): Book {
  return {
    ...book,
    audioFolder: "",
    cover: resolveCatalogImageUrl(book.cover) ?? book.cover,
    stories: book.stories.map((story) => ({
      ...story,
      audio: resolveCatalogAudioUrl(story.audio) ?? story.audio,
      cover: resolveCatalogImageUrl(story.cover) ?? story.cover,
    })),
  };
}

export const books: Record<string, Book> = {
  [colloquialgermanstories.id]: normalizeCatalogBook(colloquialgermanstories),
  [colombianspanishstoriesforbeginners.id]: normalizeCatalogBook(colombianspanishstoriesforbeginners),
  [shortstoriesincolombianspanish.id]: normalizeCatalogBook(shortstoriesincolombianspanish),
  [spanishshortstorieson20mexicanwonders.id]: normalizeCatalogBook(spanishshortstorieson20mexicanwonders),
};
