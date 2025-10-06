import { ssEsMx } from "@/data/books/ss-es-mx";
import { ssEsEs } from "@/data/books/ss-es-es";
import { ssEsArg } from "@/data/books/ss-es-arg";
import { ssDeDe } from "@/data/books/ss-de-de";
import Link from "next/link";

const allBooks = [ssEsMx, ssEsEs, ssEsArg, ssDeDe];

export default function FreebiesPage() {
  // Filtramos todas las historias con isFree === true
  const freeStories = allBooks.flatMap(book =>
    book.stories
      .filter(story => story.isFree)
      .map(story => ({ ...story, bookId: book.id, bookTitle: book.title }))
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Historias gratuitas</h1>
      <p className="mb-6 text-gray-600">
        Disfruta de una selección de historias gratis cada semana. Descubre su estilo
        y luego explora el libro completo.
      </p>
      <ul className="space-y-4">
        {freeStories.map(story => (
          <li key={story.id} className="p-4 border rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold mb-2">{story.title}</h2>
            <p className="text-sm text-gray-500 mb-3">
              Parte del libro: {story.bookTitle}
            </p>
            <Link
              href={`/books/${story.bookId}/stories?id=${story.id}`}
              className="text-blue-600 font-medium hover:underline"
            >
              Leer gratis →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
