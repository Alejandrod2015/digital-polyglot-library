'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { books } from '@/data/books';
import Cover from '@/components/Cover';

type UserStory = {
  id: string;
  title: string;
  language: string;
  level: string;
  text: string;
};

export default function ExplorePage() {
  const [selectedLang, setSelectedLang] = useState<string>('All');
  const [polyglotStories, setPolyglotStories] = useState<UserStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);

  // Cargar historias Polyglot desde la API
  useEffect(() => {
    async function fetchStories() {
      try {
        const res = await fetch('/api/user-stories');
        if (!res.ok) throw new Error('Failed to fetch stories');
        const data = await res.json();
        setPolyglotStories(data.stories || []);
      } catch (error) {
        console.error('Error loading stories:', error);
      } finally {
        setLoadingStories(false);
      }
    }
    fetchStories();
  }, []);

  // Agrupar libros por idioma
  const groupedByLanguage: Record<string, typeof books[keyof typeof books][]> = {};
  Object.values(books).forEach((book) => {
    const lang = book.language || 'Unknown';
    if (!groupedByLanguage[lang]) groupedByLanguage[lang] = [];
    groupedByLanguage[lang].push(book);
  });

  const languages = Object.keys(groupedByLanguage).sort();

  // Filtrar según el idioma seleccionado
  const visibleBooks = useMemo(() => {
    if (selectedLang === 'All') return Object.values(books);
    return groupedByLanguage[selectedLang] ?? [];
  }, [selectedLang]);

  return (
    <div className="max-w-5xl mx-auto p-8 text-white">
      <h1 className="text-3xl font-bold mb-8">Explore</h1>

      {/* Filtros por idioma */}
      <div className="flex flex-wrap gap-3 mb-10">
        <button
          onClick={() => setSelectedLang('All')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            selectedLang === 'All'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          All
        </button>
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => setSelectedLang(lang)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedLang === lang
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Historias Polyglot */}
      <div className="mb-16">
        <h2 className="text-2xl font-semibold mb-6 text-emerald-400">
          Polyglot Stories
        </h2>

        {loadingStories ? (
          <p className="text-gray-400">Loading stories...</p>
        ) : polyglotStories.length === 0 ? (
          <p className="text-gray-400">
            No Polyglot stories have been published yet.
          </p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2">
            {polyglotStories.map((story) => (
              <Link
                key={story.id}
                href={`/stories/${story.id}`}
                className="flex bg-[#141A33] hover:bg-[#1B2347] transition-colors rounded-2xl overflow-hidden shadow-lg"
              >
                <div className="p-5 flex flex-col justify-center text-left">
                  <h3 className="text-xl font-semibold mb-2 text-white">
                    {story.title}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                    {story.text?.replace(/<[^>]+>/g, "").slice(0, 120) ?? ""}...
                  </p>
                  <div className="mt-3 text-sm text-gray-400 space-y-1">
                    {story.language && (
                      <p>
                        <span className="font-semibold text-gray-300">
                          Language:
                        </span>{' '}
                        {story.language}
                      </p>
                    )}
                    {story.level && (
                      <p>
                        <span className="font-semibold text-gray-300">
                          Level:
                        </span>{' '}
                          {story.level}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Libros editoriales */}
      <h2 className="text-2xl font-semibold mb-6 text-blue-400">Books</h2>
      {visibleBooks.length === 0 ? (
        <p className="text-gray-400">No books available for this language.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2">
          {visibleBooks.map((book) => (
            <Link
              key={book.slug}
              href={`/books/${book.slug}?from=explore`}
              className="flex bg-[#141A33] hover:bg-[#1B2347] transition-colors rounded-2xl overflow-hidden shadow-lg"
            >
              <div className="w-40 flex-shrink-0">
                <Cover src={book.cover} alt={book.title} />
              </div>

              <div className="p-5 flex flex-col justify-center text-left">
                <h3 className="text-xl font-semibold mb-2 text-white">
                  {book.title}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                  {book.description}
                </p>
                <div className="mt-3 text-sm text-gray-400 space-y-1">
                  {book.language && (
                    <p>
                      <span className="font-semibold text-gray-300">
                        Language:
                      </span>{' '}
                      {book.language}
                    </p>
                  )}
                  {book.level && (
                    <p>
                      <span className="font-semibold text-gray-300">
                        Level:
                      </span>{' '}
                      {book.level}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
