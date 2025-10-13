'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { books } from '@/data/books';
import Cover from '@/components/Cover';

export default function ExplorePage() {
  const [selectedLang, setSelectedLang] = useState<string>('All');

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

      {/* Libros filtrados */}
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
