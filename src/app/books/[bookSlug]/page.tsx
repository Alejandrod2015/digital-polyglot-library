import { books } from "@/data/books";
import Link from "next/link";
import { LEVEL_LABELS } from "@/types/books";
import Cover from "@/components/Cover";

type BookPageProps = {
  params: Promise<{ bookSlug: string }>;
};


export default async function BookPage({ params }: BookPageProps) {
  const { bookSlug } = await params;


  const book = Object.values(books).find((b) => b.slug === bookSlug);

  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Portada */}
      <div className="flex justify-center md:justify-end order-1 md:order-2">
        <div className="w-[240px] aspect-[2/3]">
          <Cover src={book.cover} alt={`Portada de ${book.title}`} />
        </div>
      </div>

      {/* Info */}
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

        {/* Botón principal → primera historia */}
        <Link
          href={`/books/${book.slug}/${book.stories[0].slug}`}
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700"
        >
          Start reading
        </Link>

        {/* Tabla de contenidos */}
        <div className="mt-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">Table of contents</h2>
          <ul className="space-y-3">
            {book.stories.map((story) => (
              <li key={story.id}>
                <Link
                  href={`/books/${book.slug}/${story.slug}`}
                  className="block p-4 bg-gray-800 rounded-xl text-gray-200 hover:bg-gray-700"
                >
                  {story.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ✅ Generación de rutas estáticas
export function generateStaticParams() {
  return Object.values(books).map((book) => ({ bookSlug: book.slug }));
}
