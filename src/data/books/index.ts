import type { Book } from "@/types/books";
import { spanishshortstorieson20mexicanwonders } from "./spanish-short-stories-on-20-mexican-wonders";
import { shortstoriesincolombianspanish } from "./short-stories-in-colombian-spanish";

export const books: Record<string, Book> = {
  [spanishshortstorieson20mexicanwonders.id]: spanishshortstorieson20mexicanwonders,
  [shortstoriesincolombianspanish.id]: shortstoriesincolombianspanish,
};
