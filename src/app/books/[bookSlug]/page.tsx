import { books } from "@/data/books";
import BackButton from "@/components/BackButton";
import BookStorefront from "@/components/BookStorefront";

type BookPageProps = {
  params: Promise<{ bookSlug: string }>;
  searchParams: Promise<{ from?: string; returnTo?: string; returnLabel?: string }>;
};

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
  // Keep book page in browser history so back gesture/button returns to the book first.
  const replaceStoryNavigation = false;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* 👇 botón de retroceso jerárquico */}
      <div className="hidden md:block mb-6">
        <BackButton />
      </div>

      <BookStorefront
        book={book}
        storyNavSuffix={storyNavSuffix}
        replaceStoryNavigation={replaceStoryNavigation}
      />
    </div>
  );
}

// ✅ Generación de rutas estáticas
export function generateStaticParams() {
  return Object.values(books).map((book) => ({ bookSlug: book.slug }));
}
