
// src/app/books/[bookSlug]/[storySlug]/page.tsx

import { books } from "@/data/books";
import StoryReaderClient from "../StoryReaderClient";
import VocabPanel from "@/components/VocabPanel";
import { currentUser } from "@clerk/nextjs/server"; // 👈 nuevo import

type StoryPageProps = {
  params: Promise<{ bookSlug: string; storySlug: string }>;
};

export default async function StoryPage({ params }: StoryPageProps) {
  const { bookSlug, storySlug } = await params;

  const book = Object.values(books).find((b) => b.slug === bookSlug);
  const story = book?.stories.find((s) => s.slug === storySlug);

  if (!book || !story) {
    return <div className="p-8 text-center">Historia no encontrada.</div>;
  }

  // 🔐 Verificar plan de usuario con Clerk
  const user = await currentUser();
  const userPlan = (user?.publicMetadata?.plan as string | undefined) ?? "free";

  // Reglas de acceso por nivel
  const canAccess =
    story.isFree ||
    userPlan === "premium" ||
    userPlan === "polyglot";

  if (!canAccess) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-semibold mb-4">Contenido Premium 🔒</h2>
        <p className="mb-6 text-gray-300">
          Esta historia está disponible solo para usuarios Premium o Polyglot.
        </p>
        <a
          href="/upgrade"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-500 transition"
        >
          Actualizar tu plan
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8 pb-32">
      <h1 className="text-3xl font-bold mb-6 text-white">{story.title}</h1>

      {/* Usa el client que ya tienes en /src/app/books/StoryReaderClient.tsx */}
      <StoryReaderClient book={book} story={story} />

      {/* Panel de vocabulario (escucha clicks globales) */}
      <VocabPanel story={story} />
    </div>
  );
}

export function generateStaticParams() {
  return Object.values(books).flatMap((book) =>
    book.stories.map((story) => ({
      bookSlug: book.slug,
      storySlug: story.slug,
    }))
  );
}
