import type { Book } from "@/types/books";
import { librodeprueba } from "./libro-de-prueba";

export const books: Record<string, Book> = {
  [librodeprueba.id]: librodeprueba,
};
