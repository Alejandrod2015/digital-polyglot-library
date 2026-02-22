import type { Book } from "@/types/books";
import { spanishshortstorieson20mexicanwonders } from "./spanish-short-stories-on-20-mexican-wonders";
import { colombianspanishstoriesforbeginners } from "./colombian-spanish-stories-for-beginners";
import { shortstoriesincolombianspanish } from "./short-stories-in-colombian-spanish";
import { colloquialgermanstories } from "./colloquial-german-stories";

export const books: Record<string, Book> = {
  [spanishshortstorieson20mexicanwonders.id]: spanishshortstorieson20mexicanwonders,
  [colombianspanishstoriesforbeginners.id]: colombianspanishstoriesforbeginners,
  [shortstoriesincolombianspanish.id]: shortstoriesincolombianspanish,
  [colloquialgermanstories.id]: colloquialgermanstories,
};
