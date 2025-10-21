// /src/app/story-of-the-week/page.tsx
import { getFeaturedStory } from "@/lib/getFeaturedStory";
import { getBookMeta } from "@/lib/books";
import Link from "next/link";
import Image from "next/image";
import { client } from "@/sanity/lib/client";

export const dynamic = "force-dynamic";

export default async function StoryOfTheWeekPage() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  // 🚫 Ya no se llama a updateStoryOfTheWeek aquí.
  // La actualización automática se maneja solo por el cron.
  const featured = await getFeaturedStory("week", tz);

  if (!featured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 text-gray-300 bg-[#0D1B2A]">
        <p>No hay una historia destacada esta semana.</p>
        <Link
          href="/explore"
          className="mt-6 px-6 py-3 bg-sky-600 rounded-xl hover:bg-sky-700 transition"
        >
          Explorar historias
        </Link>
      </div>
    );
  }

  const story = await client.fetch(
    `*[_type == "story" && slug.current == $slug][0]{
      title,
      "slug": slug.current,
      focus,
      book->{
        title,
        "slug": slug.current,
        "cover": coalesce(cover.asset->url, "/covers/default.jpg"),
        description,
        language,
        level,
        topic
      }
    }`,
    { slug: featured.slug }
  );

  if (!story || !story.book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 text-gray-300 bg-[#0D1B2A]">
        <p>La historia destacada no se encontró.</p>
        <Link
          href="/explore"
          className="mt-6 px-6 py-3 bg-sky-600 rounded-xl hover:bg-sky-700 transition"
        >
          Explorar historias
        </Link>
      </div>
    );
  }

  const book = story.book;
  const meta = await getBookMeta(book.slug);
  const coverUrl = book.cover || meta.cover || "/covers/default.jpg";

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white flex flex-col items-center justify-center px-4 sm:px-8 py-12">
      <div className="max-w-5xl w-full bg-white/5 rounded-3xl shadow-xl p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-10 border border-white/10">
        {/* Portada */}
        <div className="w-full sm:w-1/3 flex justify-center">
          <div className="relative aspect-[3/4] w-56 sm:w-64 rounded-xl overflow-hidden shadow-lg border border-white/10">
            <Image
              src={coverUrl}
              alt={story.title}
              fill
              className="object-cover"
            />
          </div>
        </div>

        {/* Contenido */}
        <div className="w-full sm:w-2/3 text-center sm:text-left">
          <p className="uppercase tracking-widest text-sky-400 text-sm mb-2">
            Story of the Week
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            {story.title}
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            From{" "}
            <span className="text-white font-medium">
              {book.title || meta.title}
            </span>
          </p>

          {/* Etiquetas dinámicas */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-6">
            {book.language && (
              <span className="px-3 py-1 rounded-full bg-blue-600/20 text-blue-200 text-xs sm:text-sm capitalize">
                {book.language}
              </span>
            )}
            {book.level && (
              <span className="px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-200 text-xs sm:text-sm capitalize">
                Level: {book.level}
              </span>
            )}
            {book.topic && (
              <span className="px-3 py-1 rounded-full bg-pink-600/20 text-pink-200 text-xs sm:text-sm capitalize">
                Theme: {book.topic}
              </span>
            )}
            {story.focus && (
              <span className="px-3 py-1 rounded-full bg-yellow-600/20 text-yellow-200 text-xs sm:text-sm capitalize">
                Focus: {story.focus}
              </span>
            )}
          </div>

          {/* Descripción */}
          <p className="text-gray-300 leading-relaxed mb-8">
            {book.description ||
              meta.description ||
              `From the book "${book.title || meta.title}", this story invites you to explore language and culture through authentic storytelling.`}
          </p>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center">
            <Link
              href={`/books/${book.slug}/${story.slug}`}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-700 rounded-xl font-medium transition text-center"
            >
              Read for free
            </Link>
            <Link
              href="/plans"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition text-center text-white"
            >
              Unlock all stories
            </Link>
          </div>

          <p className="text-gray-400 text-xs mt-6">
            Free to read this week only.
          </p>
        </div>
      </div>
    </div>
  );
}
