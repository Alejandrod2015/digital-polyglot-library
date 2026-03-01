import { books } from "@/data/books";
import Link from "next/link";
import Cover from "@/components/Cover";
import AddToLibraryButton from "@/components/AddToLibraryButton";
import BackButton from "@/components/BackButton";
import BookStoriesGrid from "@/components/BookStoriesGrid";
import { Play, ShoppingBag } from "lucide-react";
import { formatLanguage, formatLevel, formatTopic, toTitleCase } from "@/lib/displayFormat";

type BookPageProps = {
  params: Promise<{ bookSlug: string }>;
  searchParams: Promise<{ from?: string; returnTo?: string; returnLabel?: string }>;
};

function toExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { bookSlug } = await params;
  const { from, returnTo, returnLabel } = await searchParams;

  const book = Object.values(books).find((b) => b.slug === bookSlug);
  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  const storyNavParams = new URLSearchParams();
  if (returnTo && isSafeInternalPath(returnTo)) {
    storyNavParams.set("returnTo", returnTo);
    if (returnLabel?.trim()) storyNavParams.set("returnLabel", returnLabel.trim());
  } else if (from?.trim()) {
    storyNavParams.set("from", from.trim());
  }
  const storyNavSuffix = storyNavParams.toString() ? `?${storyNavParams.toString()}` : "";
  const replaceStoryNavigation = storyNavSuffix.length > 0;

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

          {/* Etiquetas (mantiene el estilo original) */}
          <div className="flex flex-wrap gap-2 mb-6">
            {book.language && (
              <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap">
                {formatLanguage(book.language)}
              </span>
            )}
            {book.level && (
              <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap">
                {formatLevel(book.level)}
              </span>
            )}
            {book.region && (
              <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap">
                {toTitleCase(book.region)}
              </span>
            )}
            {book.topic && (
              <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap">
                {formatTopic(book.topic)}
              </span>
            )}
            {book.formality && (
              <span className="px-3 py-1 bg-gray-700 text-gray-100 text-sm rounded-full whitespace-nowrap">
                {toTitleCase(book.formality)}
              </span>
            )}
          </div>

          {/* Botones principales en una fila */}
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <Link
              href={`/books/${book.slug}/${book.stories[0].slug}${storyNavSuffix}`}
              replace={replaceStoryNavigation}
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

            {book.storeUrl && (
              <a
                href={toExternalUrl(book.storeUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                <ShoppingBag className="h-5 w-5" />
                Buy physical book
              </a>
            )}
          </div>

          {/* Tabla de contenidos */}
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4 text-white">
              Stories
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              {book.stories.length} stories in this book
            </p>

            <BookStoriesGrid
              book={book}
              stories={book.stories}
              hrefSuffix={storyNavSuffix}
              replaceNavigation={replaceStoryNavigation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Generación de rutas estáticas
export function generateStaticParams() {
  return Object.values(books).map((book) => ({ bookSlug: book.slug }));
}
