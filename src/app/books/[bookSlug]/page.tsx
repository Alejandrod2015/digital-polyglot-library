import { books } from "@/data/books";
import Link from "next/link";
import { LEVEL_LABELS } from "@/types/books";
import Cover from "@/components/Cover";
import { getFreeStorySlugs } from "@/data/freeStories";
import AddToLibraryButton from "@/components/AddToLibraryButton";
import BackButton from "@/components/BackButton";
import { Play } from "lucide-react";

type BookPageProps = {
  params: Promise<{ bookSlug: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { bookSlug } = await params;
  const { from } = await searchParams;

  const book = Object.values(books).find((b) => b.slug === bookSlug);
  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  const promotionalSlugs = await getFreeStorySlugs();

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* 👇 botón de retroceso jerárquico */}
      <div className="hidden md:block mb-6">
        <BackButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
  {book.language && (
    <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap capitalize">
      {book.language}
    </span>
  )}
  {book.level && (
    <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap capitalize">
      {LEVEL_LABELS[book.level]}
    </span>
  )}
  {book.region && (
    <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap capitalize">
      {book.region}
    </span>
  )}
  {book.topic && (
    <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap capitalize">
      {book.topic}
    </span>
  )}
  {book.formality && (
    <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap capitalize">
      {book.formality}
    </span>
  )}
</div>



          {/* Botones principales en una fila */}
          <div className="flex flex-wrap items-center gap-4">
  <Link
  href={`/books/${book.slug}/${book.stories[0].slug}`}
  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
>
  <Play className="h-5 w-5" />
  Start reading
</Link>

  <AddToLibraryButton
    bookId={book.slug}
    title={book.title}
    coverUrl={
      typeof book.cover === "string" && book.cover.length > 0
        ? book.cover
        : "/covers/default.jpg"
    }
  />
</div>


          {/* Tabla de contenidos */}
          <div className="mt-10">
            <h2 className="text-2xl font-semibold mb-4 text-white">
              Table of contents
            </h2>
            <ul className="space-y-3">
              {book.stories.map((story) => {
                const isPromo = promotionalSlugs.includes(story.slug);
                return (
                  <li key={story.id}>
                    <Link
                      href={`/books/${book.slug}/${story.slug}`}
                      className="block p-4 bg-gray-800 rounded-xl text-gray-200 hover:bg-gray-700 relative transition-colors"
                    >
                      <span>{story.title}</span>
                      {isPromo && (
                        <span
                          className="absolute top-3 right-3 flex items-center gap-1
                                    bg-gradient-to-r from-amber-400 to-yellow-300
                                    text-black text-sm font-semibold px-3 py-1.5
                                    rounded-full shadow-md border border-amber-200/70"
                        >
                          <span>🎁</span>
                          <span>Free this week</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Botón para comprar el libro físico */}
          {book.storeUrl && (
            <Link
              href={book.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 px-6 py-3 bg-amber-500 text-black font-semibold rounded-xl shadow hover:bg-amber-600 transition-colors"
            >
              🛒 Buy physical book
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ✅ Generación de rutas estáticas
export function generateStaticParams() {
  return Object.values(books).map((book) => ({ bookSlug: book.slug }));
}
