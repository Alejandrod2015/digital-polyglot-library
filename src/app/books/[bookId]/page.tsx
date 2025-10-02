import { books } from "@/data/books";
import Link from "next/link";
import Image from "next/image";
import { LEVEL_LABELS } from "@/types/books";

// 👇 Tipado correcto para Next.js App Router
type BookPageProps = {
  params: {
    bookId: string;
  };
};

export default function BookPage({ params }: BookPageProps) {
  const { bookId } = params;
  const book = books[bookId];

  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Portada: arriba en mobile, derecha en desktop */}
      <div className="flex justify-center md:justify-end order-1 md:order-2">
        <Image
          src={book.cover || "/globe.svg"}
          alt={`Portada de ${book.title}`}
          width={240}
          height={320}
          className="rounded-2xl shadow-lg object-cover"
        />
      </div>

      {/* Texto: debajo en mobile, izquierda en desktop */}
      <div className="md:col-span-2 text-left order-2 md:order-1">
        <h1 className="text-3xl font-bold mb-2 text-white">{book.title}</h1>

        {book.subtitle && (
          <h2 className="text-xl text-gray-200 mb-4">{book.subtitle}</h2>
        )}

        <p className="text-lg text-gray-400 mb-6">{book.description}</p>

        {/* Etiquetas */}
        <div className="flex flex-wrap gap-2 mb-6">
          {book.theme &&
            (Array.isArray(book.theme) ? book.theme : [book.theme]).map((t, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap"
              >
                {t}
              </span>
            ))}

          {book.level && (
            <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full whitespace-nowrap">
              {LEVEL_LABELS[book.level]}
            </span>
          )}
        </div>

        <Link
          href={`/books/${bookId}/stories`}
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700"
        >
          Start reading
        </Link>
        
        {/* Historias incluidas */}
        <div className="mt-10">
        <h2 className="text-2xl font-semibold mb-4 text-white">Historias incluidas</h2>
        <ul className="space-y-3">
            {book.stories.map((story) => (
            <li
                key={story.id}
                className="p-4 bg-gray-800 rounded-xl flex justify-between items-center"
            >
                <span className="text-gray-200">{story.title}</span>
                <Link
                href={`/books/${bookId}/stories?storyId=${story.id}`}
                className="text-blue-400 hover:text-blue-200 text-sm"
                >
                Leer →
                </Link>
            </li>
            ))}
        </ul>
        </div>

      </div>
    </div>
  );
}

// ✅ Para que Next.js genere las rutas estáticas
export function generateStaticParams() {
  return Object.keys(books).map((id) => ({ bookId: id }));
}
