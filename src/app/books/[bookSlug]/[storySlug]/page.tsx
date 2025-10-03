import { books } from "@/data/books";
import Player from "@/components/Player";

type StoryPageProps = {
  params: {
    bookSlug: string;
    storySlug: string;
  };
};

export default function StoryPage({ params }: StoryPageProps) {
  const { bookSlug, storySlug } = params;

  // Buscar el libro por slug
  const book = Object.values(books).find((b) => b.slug === bookSlug);
  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  // Buscar la historia por slug
  const story = book.stories.find((s) => s.slug === storySlug);
  if (!story) {
    return <div className="p-8 text-center">Historia no encontrada.</div>;
  }

  return (
  <div className="max-w-3xl mx-auto p-8 text-gray-100 pb-40">
    {/* 👆 agregamos padding-bottom para que el texto no quede escondido detrás del player */}

    <h1 className="text-3xl font-bold mb-4">{story.title}</h1>

    {/* Renderiza el HTML de la historia */}
    <div
      className="max-w-none mb-8
    [&>p]:mb-6 [&>p]:text-gray-300 [&>p]:text-lg [&>p]:leading-relaxed
    [&>blockquote]:mb-6 [&>blockquote]:text-gray-300 [&>blockquote]:text-lg 
    [&>blockquote]:leading-relaxed [&>blockquote]:not-italic [&>blockquote]:font-normal 
    [&>blockquote]:border-none"
      dangerouslySetInnerHTML={{ __html: story.text }}
    />

    {/* 🎧 Player fijo en la parte inferior */}
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <Player src={`${book.audioFolder}/${story.audio}`} />
    </div>
  </div>
);

}

// ✅ Genera rutas estáticas para todas las historias
export function generateStaticParams() {
  const params: { bookSlug: string; storySlug: string }[] = [];

  Object.values(books).forEach((book) => {
    book.stories.forEach((story) => {
      params.push({
        bookSlug: book.slug,
        storySlug: story.slug,
      });
    });
  });

  return params;
}
