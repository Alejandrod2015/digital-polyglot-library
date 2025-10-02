import { ssEsArg } from "./ss-es-arg";
import { ssEsEs } from "./ss-es-es";
import { ssEsMx } from "./ss-es-mx";
import { ssDeDe } from "./ss-de-de";
import type { Book } from "@/types/books";

// 👇 Aquí juntamos todos los libros en un solo objeto
export const books: Record<string, Book> = {
  [ssEsArg.id]: ssEsArg,
  [ssEsEs.id]: ssEsEs,
  [ssEsMx.id]: ssEsMx,
  [ssDeDe.id]: ssDeDe,
};
